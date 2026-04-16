# Pyramid Office Solutions — Business Intelligence Dashboard

Live dashboard: https://pyramidinstall.github.io/pyramid-dashboard

## Setup

### First time
```bash
npm install
npm start
```

### Deploy to GitHub Pages
Push to `main` branch — GitHub Actions deploys automatically.

Or manually:
```bash
npm run deploy
```

## Data refresh
Update the Google Sheet → click ↻ in the dashboard navbar.

## Adding prospects
Open the Google Sheet → `prospects` tab → add a row.

## Updating data sources
1. Export from IQ as JSON
2. Open Google Sheet
3. Clear the relevant tab (keep header row)
4. Paste new data
5. Click ↻ in dashboard

## Access
- jordan@pyramidinstall.com → Owner view (all pages)
- billy@pyramidinstall.com → Team view (Pipeline, Backlog, Relationships, Commission)
