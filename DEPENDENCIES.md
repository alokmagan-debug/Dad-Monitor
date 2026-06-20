# Dependencies

## Netlify Function (`netlify/functions/analyze.js`)
**Zero npm dependencies.** Uses Node.js native `fetch` (built into Node 18+).
Netlify's default Node runtime (Node 18 or 20) supports this natively — no `package.json` install step required.

## Bridge Script (`bridge.py`)
Python 3.8+ required. Tested on:
- Python 3.11.9
- macOS (Apple Silicon and Intel)

| Package    | Minimum Version | Tested Version | Purpose                          |
|------------|-----------------|-----------------|-----------------------------------|
| requests   | 2.31.0          | 2.33.1          | HTTP calls to Netlify and ntfy.sh |

Install with:
```
pip3 install -r requirements.txt --break-system-packages
```
(The `--break-system-packages` flag is needed on newer macOS/Homebrew Python installs that protect the system Python environment. Using a virtual environment is recommended instead — see below.)

### Recommended: use a virtual environment
```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## External Tools (not pip/npm packages)

| Tool    | Minimum Version | Tested Version | Purpose                                   |
|---------|-----------------|-----------------|---------------------------------------------|
| ffmpeg  | 5.0+            | 8.1.2           | Captures snapshots from the Wyze RTSP stream |

Install ffmpeg via Homebrew:
```
brew install ffmpeg
```

## Hardware / Third-Party Services

| Service/Device      | Notes                                                              |
|----------------------|---------------------------------------------------------------------|
| Wyze Cam v3          | RTSP must be enabled in Wyze app advanced settings; IR night vision should be turned ON (not Auto with lights off, set explicitly On or Auto works once tested) |
| Anthropic API key    | Required for Claude Vision analysis. User must provide their own key as an environment variable. Costs scale with check frequency. |
| Netlify account      | Free tier is sufficient. Used to host the analyze function.        |
| ntfy.sh              | Free, no account required. Used for push notifications.            |
| GitHub account       | Used to connect repo to Netlify for auto-deploy.                   |

## Known Version Constraints
- `requests` should stay below 3.0.0 until verified compatible (no known issues currently, just a sane upper bound).
- ffmpeg's RTSP handling has changed across major versions; 5.0+ recommended for `-rtsp_transport tcp` flag support and modern TLS/auth handling.
- This project assumes Wyze Cam v3 firmware as of mid-2026; Wyze occasionally changes RTSP authentication behavior in firmware updates, which may require re-testing the RTSP connection after camera firmware updates.
