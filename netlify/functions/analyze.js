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

  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { image, consecutiveCount } = body;

  if (!image) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No image provided' }) };
  }

  const prompt = `You are a medical safety monitor watching an elderly patient in bed at night.

Analyze this image and detect exactly two things:

1. OXYGEN: Is the patient wearing a nasal cannula or oxygen mask?
   - Clearly visible on face: "ON"
   - Not visible, removed, or face not in frame: "NOT VISIBLE"
   - Image too dark or unclear: "UNKNOWN"

2. BED: What is the patient's position?
   - Lying down safely in bed: "LYING SAFE"
   - Sitting up or legs over edge: "SITTING UP"
   - Not in bed or standing: "OFF BED"
   - Camera blocked or unclear: "UNKNOWN"

3. CAMERA: Is the camera view blocked or too dark to see anything?
   - Clear view: "OK"
   - Blocked or too dark: "BLOCKED"

Respond ONLY in this exact JSON format:
{"oxygen":"ON","bed":"LYING SAFE","camera":"OK","note":"one brief sentence"}`;

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
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: image,
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    claudeData = await response.json();
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Anthropic API error: ' + e.message }),
    };
  }

  let result;
  try {
    const raw = claudeData.content[0].text.replace(/```json|```/g, '').trim();
    result = JSON.parse(raw);
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Could not parse Claude response', raw: claudeData }),
    };
  }

  // Determine if this is a risky reading
  const isRisky =
    result.oxygen === 'NOT VISIBLE' ||
    result.bed === 'SITTING UP' ||
    result.bed === 'OFF BED' ||
    result.camera === 'BLOCKED';

  // Send ntfy alert if 2+ consecutive risky readings
  let alertSent = false;
  if (isRisky && consecutiveCount >= 2) {
    const issues = [];
    if (result.oxygen === 'NOT VISIBLE') issues.push('Oxygen cannula not visible');
    if (result.bed === 'SITTING UP') issues.push('Patient sitting up — may be getting out of bed');
    if (result.bed === 'OFF BED') issues.push('Patient may be off the bed');
    if (result.camera === 'BLOCKED') issues.push('Camera is blocked or too dark');

    const alertMsg = issues.join(' + ');

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
    } catch (e) {
      // ntfy failed silently
    }
  }

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      oxygen: result.oxygen,
      bed: result.bed,
      camera: result.camera,
      note: result.note,
      isRisky,
      alertSent,
    }),
  };
};
