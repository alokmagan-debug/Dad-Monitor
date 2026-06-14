# Dad Monitor — Deployment Steps

## Files
```
dad-monitor/
├── index.html
├── netlify.toml
└── netlify/
    └── functions/
        └── analyze.js
```

## Step 1 — Push to GitHub

1. Go to github.com and sign in
2. Click + → New repository
3. Name: dad-monitor
4. Set to Public
5. Do NOT add README
6. Click Create repository

On your Mac Terminal:
```
cd ~/Documents/dad-monitor
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/dad-monitor.git
git push -u origin main
```

## Step 2 — Connect to Netlify

1. Go to app.netlify.com
2. Click Add new site → Import an existing project
3. Click GitHub
4. Authorize Netlify
5. Select dad-monitor repo
6. Build settings: leave all blank
7. Click Deploy site

## Step 3 — Add Environment Variables

In Netlify dashboard:
1. Go to Site configuration → Environment variables
2. Add variable: ANTHROPIC_API_KEY = your key
3. Add variable: NTFY_TOPIC = Alok-dad-monitor
4. Click Save
5. Go to Deploys → Trigger deploy → Deploy site

## Step 4 — Open on iPhone 14

Open your Netlify URL in Safari on iPhone 14.
Tap Start Monitoring and allow camera.
