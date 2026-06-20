exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const NTFY_TOPIC = process.env.NTFY_TOPIC || 'Alok-dad-monitor';
  const NTFY_COMMAND_TOPIC = process.env.NTFY_COMMAND_TOPIC || 'Alok-dad-command';

  if (!ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { image, consecutiveCount, isOnDemand } = body;

  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No image provided' }) };
  }

  const prompt = `You are a medical safety monitor watching an elderly patient in bed at any time of day or night.

Analyze this image and detect exactly:

1. OXYGEN: Is the patient wearing a nasal cannula or oxygen mask?

This is a low-light/infrared night vision camera - images will be grainy and black and white. Be extra careful before concluding the cannula is missing.

A nasal cannula is a THIN, often hard-to-see tube that may appear as:
- A thin line or wire-like shape near or below the nose
- Tubing running along the cheek toward the ear, even if faint
- A small loop or curve near the nostrils
- The tubing may follow the curve of the face when the patient is lying on their side, not just straight across both cheeks

In grainy IR images the cannula often looks like a thin gray line that can be mistaken for a wrinkle, shadow, or pillow fold. Look very closely along the path from the nose toward the ear before deciding there is nothing there.

An oxygen mask is a device that may cover the nose and mouth, or sometimes just rest near the nose/upper lip area. In low light it may appear as:
- A darker curved shape or frame across the lower face
- Straps or a band running from the face toward/around the ear or head
- A visible rim, edge, or strap line that doesn't match natural face contours
- Any rigid-looking line or strap crossing the cheek toward the ear, distinct from the soft curves of skin

If you see any strap, band, frame, or rigid line crossing the face toward the ear that looks different from skin or pillow texture, treat this as a mask or cannula being worn, even if you cannot identify the exact device type.

   - ANY thin tubing, line, or mask visible near the face, even partial or faint: "ON"
   - Patient's face is clearly visible, well lit enough to see detail, and there is definitively no tubing or mask anywhere near nose/mouth/cheeks/ears: "NOT VISIBLE"
   - Face partially visible, image too grainy/dark to be confident, or angle makes it hard to see the nose/cheek area clearly: "UNKNOWN"

2. BED: What is the patient's position and location?
   - Lying down safely in bed: "LYING SAFE"
   - Sitting up in bed or legs over edge: "SITTING UP"
   - Safely seated in a wheelchair or chair (not in bed): "IN CHAIR"
   - Standing or walking: "STANDING"
   - Unclear or not visible: "UNKNOWN"

2b. ORIENTATION (only fill this in if BED is "LYING SAFE" - otherwise use "N/A"):
Describe which way the patient's body is turned while lying down, for pressure sore prevention tracking:
   - Lying on their left side (body/face turned toward their left): "LEFT SIDE"
   - Lying on their right side (body/face turned toward their right): "RIGHT SIDE"
   - Lying flat on their back, face/chest upward: "BACK"
   - Lying flat on their stomach, face downward: "STOMACH"
   - Cannot tell orientation clearly: "UNCLEAR"

3. CAREGIVER: Is there a second person (caregiver, family member, nurse) visible in the frame actively present with or attending to the patient?
   - Yes, another person is clearly visible near/with the patient: "PRESENT"
   - No other person visible, patient appears alone: "ALONE"
   - Cannot tell: "UNKNOWN"

3. CAMERA: Is the view clear?
   - Clear: "OK"
   - Blocked or too dark: "BLOCKED"

Respond ONLY in this JSON:
{"oxygen":"ON","bed":"LYING SAFE","orientation":"LEFT SIDE","caregiver":"ALONE","camera":"OK","note":"one brief sentence describing what you see"}`;

  let claudeData;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      }),
    });
    claudeData = await response.json();
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Anthropic API error: ' + e.message }) };
  }

  let result;
  try {
    const raw = claudeData.content[0].text.replace(/```json|```/g, '').trim();
    result = JSON.parse(raw);
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not parse Claude response', fullClaudeResponse: claudeData }) };
  }

  const caregiverPresent = result.caregiver === 'PRESENT';

  const isRisky =
    result.oxygen === 'NOT VISIBLE' ||
    (result.bed === 'SITTING UP' && !caregiverPresent) ||
    result.camera === 'BLOCKED';

  const oxygenStatus = result.oxygen === 'ON' ? 'Oxygen: Wearing' : result.oxygen === 'NOT VISIBLE' ? 'Oxygen: NOT VISIBLE' : 'Oxygen: Unclear';
  const bedStatus = result.bed === 'LYING SAFE' ? 'Bed: Lying safely' : result.bed === 'SITTING UP' ? 'Bed: SITTING UP' : result.bed === 'IN CHAIR' ? 'Bed: In wheelchair/chair' : result.bed === 'STANDING' ? 'Bed: Standing' : 'Bed: Unclear';
  const fullMessage = oxygenStatus + ' | ' + bedStatus + (result.note ? ' | ' + result.note : '');

  let alertSent = false;

  if (isOnDemand) {
    try {
      await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: {
          Title: 'Dad Status Report',
          Priority: 'default',
          Tags: 'mag',
        },
        body: fullMessage,
      });
      alertSent = true;
    } catch (e) {}
  } else if (isRisky && consecutiveCount >= 2) {
    const issues = [];
    if (result.oxygen === 'NOT VISIBLE') issues.push('Oxygen cannula not visible');
    if (result.bed === 'SITTING UP' && !caregiverPresent) issues.push('Patient sitting up alone - may be getting out of bed');
    if (result.camera === 'BLOCKED') issues.push('Camera blocked or too dark');

    const alertMsg = issues.join(' + ') + (result.note ? '. ' + result.note : '');
    try {
      await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: {
          Title: 'Dad Monitor Alert',
          Priority: 'urgent',
          Tags: 'warning,rotating_light',
        },
        body: alertMsg,
      });
      alertSent = true;
    } catch (e) {}
  }

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ oxygen: result.oxygen, bed: result.bed, orientation: result.orientation, caregiver: result.caregiver, camera: result.camera, note: result.note, isRisky, alertSent, fullMessage }),
  };
};
