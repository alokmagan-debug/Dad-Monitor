# Dad Monitor

An AI-powered camera monitoring system for caregivers, originally built to watch over an elderly parent recovering at home — checking for oxygen cannula/mask placement, unsafe bed-exit attempts, and reminding caregivers to reposition a bed-bound patient to help prevent pressure sores.

Built with Claude Vision (Anthropic), a Wyze Cam v3, and free/low-cost tools. No subscription monitoring service, no recurring fees beyond your own AI API usage.

---

## ⚠️ Important Disclaimer

**This is a personal hobby project, not a certified or regulated medical device.**

- It is a **supplemental tool only** and must never replace professional medical monitoring, in-person caregiving, nursing supervision, or emergency services.
- AI image analysis can make mistakes — it can miss real problems (false negatives) and flag non-problems (false positives). Do not rely on it as your only safety net.
- It is not designed, tested, or certified for any medical or life-safety purpose.
- If you or someone you care for is in a medical emergency, call your local emergency number immediately. Do not wait for or rely on an app notification.
- You are solely responsible for evaluating whether this tool is appropriate for your situation, for testing it thoroughly before relying on it even partially, and for maintaining proper human caregiving and medical supervision regardless of what this tool reports.
- The author(s) provide this software "as is," with no warranty of any kind, and accept no liability for any outcome related to its use. See [LICENSE](LICENSE) for full terms.

If that gives you pause — good. Use this as one extra layer of attention, never the only one.

---

## What it does

- Captures a snapshot from a camera every few minutes (default: 10 min, configurable)
- Sends the image to Claude (Anthropic's AI) for analysis
- Detects:
  - Whether an oxygen nasal cannula or mask is visible on the patient's face
  - Whether the patient is lying safely, sitting up, seated in a wheelchair, or standing
  - Whether a caregiver is present (to avoid false alarms when someone is already attending to the patient)
- Sends push notifications (via [ntfy.sh](https://ntfy.sh), free, no account needed) when:
  - Oxygen appears to be missing
  - The patient is sitting up **and alone** (possible unsupervised bed-exit attempt)
  - The patient's position hasn't changed in 2+ hours (pressure sore prevention reminder)
- Supports on-demand status checks — text a command, get back a status report with a photo
- Designed to work in low light using a Wyze Cam's built-in infrared night vision

## What it does NOT do

- Does not detect falls after they've happened (only positions visible to the camera)
- Does not measure oxygen saturation, heart rate, or any vital sign — it only checks whether the equipment is visibly in place
- Does not work reliably in total darkness without IR illumination
- Does not have a mobile app — notifications go through the free ntfy.sh service
- Does not run "in the cloud" autonomously — it requires a computer (e.g., a laptop) running the bridge script and staying on

---

## Architecture

```
Wyze Cam v3 (RTSP, local network, IR night vision)
        |
        v
bridge.py (runs on your computer, polls camera every N minutes)
        |
        v
Netlify Function (analyze.js) -- calls Anthropic Claude Vision API
        |
        v
ntfy.sh (free push notifications) --> your phone
```

The AI analysis happens server-side (Netlify), so your Anthropic API key is never exposed to your local network or any client device.

---

## Requirements

See [DEPENDENCIES.md](DEPENDENCIES.md) for exact versions tested.

**Hardware:**
- A camera with RTSP support and infrared night vision (tested with Wyze Cam v3, ~$35)
- A computer that can stay powered on and connected to your home network while monitoring is active (tested on macOS)

**Accounts (all free unless noted):**
- [Anthropic API key](https://console.anthropic.com) — **paid**, billed per API call; costs scale with how often you check and how long you run it
- [Netlify account](https://netlify.com) — free tier is sufficient
- [GitHub account](https://github.com) — to connect your fork to Netlify
- [ntfy.sh](https://ntfy.sh) — free, no account required, just pick a private topic name

---

## Setup Guide

### 1. Set up your camera

1. Buy and set up a Wyze Cam v3 (or similar RTSP-capable camera with night vision)
2. In the Wyze app: Settings → Advanced Settings → enable **RTSP**, set a username/password
3. In the Wyze app: Settings → Advanced Settings → set **Night Vision IR Lights** to On or Auto (not Off)
4. Note the RTSP URL shown (e.g. `rtsp://192.168.x.x:554/stream0`)
5. Test it works using `ffmpeg` or VLC before continuing (see DEPENDENCIES.md troubleshooting notes)

### 2. Fork and deploy the Netlify function

1. Fork this repository on GitHub
2. Go to [app.netlify.com](https://app.netlify.com) → **Add new project** → **Import an existing project** → GitHub → select your fork
3. Leave build settings blank, deploy
4. In Netlify: **Project configuration → Environment variables**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
   - `NTFY_TOPIC` = a unique, hard-to-guess topic name (e.g. `yourname-monitor-8f3k2`)
5. Trigger a redeploy so the environment variables take effect
6. Note your Netlify site URL (e.g. `https://your-site-name.netlify.app`)

### 3. Set up the bridge script

1. Install Python 3.8+ and ffmpeg (`brew install ffmpeg` on macOS)
2. Clone your fork locally
3. `pip3 install -r requirements.txt --break-system-packages` (or use a virtual environment, see DEPENDENCIES.md)
4. Copy `bridge.py.example` to `bridge.py` and fill in:
   - Your camera's RTSP URL (with username/password)
   - Your Netlify function URL
   - Your ntfy topic name (must match what you set in Netlify)
5. Run it: `python3 bridge.py`

### 4. Subscribe to notifications

1. Install the [ntfy app](https://ntfy.sh/app) on your phone (iOS/Android) or use the web version
2. Subscribe to the same topic name you set in step 2
3. Test by sending `status` to `https://ntfy.sh/your-command-topic` from any browser — you should get a status report with photo within ~20 seconds

---

## Configuration options

Inside `bridge.py`, you can adjust:

| Setting | Default | Description |
|---|---|---|
| `CHECK_INTERVAL` | 600 (10 min) | How often to capture and analyze a frame. Lower = faster detection, higher API cost. |
| `POSITION_ALERT_HOURS` | 2 | Hours of unchanged position before a reposition reminder fires. |
| `POSITION_REMINDER_COOLDOWN_HOURS` | 1 | Minimum time between repeated reposition reminders. |

---

## Costs to expect

- **Anthropic API**: roughly a fraction of a cent per check at default settings; scales linearly with check frequency. Running 24/7 at a 10-minute interval is a few dollars a month for most people; running every 20-30 seconds continuously is significantly more.
- **Netlify, ntfy.sh, GitHub**: free tiers are sufficient for personal use.
- **Wyze Cam**: one-time hardware cost (~$35). No required subscription — RTSP works without Cam Plus.

---

## Known limitations & troubleshooting tips

- AI image analysis can confuse oxygen masks/cannulas with shadows, pillow folds, or IV lines in grainy infrared footage, especially at odd angles. Test thoroughly in your specific room/lighting before trusting it.
- "Caregiver present" detection reduces false alarms but is not perfect — a caregiver partially out of frame may not be detected.
- If your home network has multiple subnets/bands (common with mesh routers), make sure the computer running `bridge.py` is on the **same network** as the camera, or RTSP will fail to connect.
- Wyze occasionally changes RTSP behavior in firmware updates — re-test your RTSP connection after any camera firmware update.
- This has only been tested on macOS. Windows/Linux should work with adjustments but haven't been verified.

---

## Contributing

This started as a one-night caregiving project, not a polished product. Issues and pull requests are welcome, especially around:
- Improving detection accuracy / prompt engineering
- Supporting other camera brands
- Windows/Linux setup instructions
- A proper setup wizard instead of manual config editing

## License

MIT License — see [LICENSE](LICENSE) for full text. This means you can use, modify, and distribute this freely, but it comes with absolutely no warranty, and the authors are not liable for any outcome from its use. Please read the Disclaimer section above as well — it is not just legal boilerplate.
