# Verify f3boise

Ionic/Angular SPA. Data comes from the live scraper API (`https://f3-scraper-rs.fly.dev`), not local fixtures.

## Build + serve

```bash
npx ng build --configuration production   # emits to www/
npx -y serve -s www -l 4200               # MUST be 4200 or 8100
```

The scraper API's CORS allowlist only includes `https://f3boise.com`, `http://localhost:4200`, and `http://localhost:8100`. Any other port loads the shell but data never arrives (silent spinner).

## Drive

One-shot screenshots (data takes a few seconds to fetch, so give a big virtual time budget):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --screenshot=out.png --window-size=1440,3200 --hide-scrollbars \
  --virtual-time-budget=45000 "http://localhost:4200/ao/bleach"
```

For clicks/modals, `npm i puppeteer-core` in the scratchpad and launch with `executablePath` pointing at the installed Chrome (no Chromium download needed).

## Flows worth driving

- `/ao/bleach` (single AO), `/region/high-desert`, `/ao/all` (multi-AO), `/pax/backslash`
- Date-range chips at the top re-run all stats; year grid is intentionally all-time
- Bogus AO name → "No data" empty state

## Gotchas

- Pages horizontally overflow at 390px width in headless Chrome — pre-existing, both PAX and AO pages; don't flag as a regression
- Region pages include region-agnostic AOs (e.g. Black Ops) in their data
