# PlantMeasure
Photograph a plant next to an object of known size, and AI estimates leaf count, health, leaf size, stem height and diameter.
Mobile-friendly web app (installable PWA) that estimates leaf count, health, leaf size, stem height and diameter from a photo taken beside a reference object of known length. AI vision runs through a small proxy so your API key never reaches the browser.

## Structure
- `index.html`, `config.js`, `sw.js`, `manifest.webmanifest`, `icon.svg`: the front end (GitHub Pages)
- `worker/`: Cloudflare Worker proxy that calls the Anthropic API

## Deploy
1. **Proxy** (free Cloudflare account, Node installed):
   ```
   cd worker
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler deploy
   ```
   Edit `ALLOWED_ORIGIN` in `wrangler.toml` to `https://<your-username>.github.io` first. Copy the worker URL it prints.
2. Put that URL in `config.js` as `PROXY_URL`.
3. **Front end**: push this repo to GitHub, then Settings > Pages > Deploy from branch `main`, folder `/ (root)`.
4. On your phone open `https://<your-username>.github.io/<repo>/`, then "Add to Home Screen".

## Notes
- Needs internet. Camera capture uses the phone's native camera.
- Keep the reference object in the same plane as the plant part and shoot straight-on. Validate against manual measurements.
- Set a spending limit on your API key; the proxy has basic size limits only.
- Optional: add `icon-192.png` / `icon-512.png` (PNG versions of `icon.svg`) for iOS home-screen icons.

