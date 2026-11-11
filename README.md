# PlantMeasure

Mobile-first web app (installable PWA) that estimates **leaf count, leaf colour and health, leaf length/width/area, stem height and diameter, and fruit diameter** from one photo taken beside a reference object of known length. AI vision runs through a small server-side proxy, so your API key never reaches the browser.

> Results are estimates. Validate against manual measurements before relying on them for research.

## Structure
| Path | Purpose |
| --- | --- |
| `index.html`, `config.js`, `sw.js`, `manifest.webmanifest`, icons | Front end (served by GitHub Pages) |
| `measure.js` | Measurement core (pixel-to-cm conversion, area, CSV); unit tested |
| `worker/` | Cloudflare Worker proxy that holds the API key and holds the prompt |
| `tests/` | Unit tests (`npm test`, Node 20+, no dependencies) |
| `.github/workflows/ci.yml` | Runs syntax checks and tests on every push and pull request |

## Deploy
1. **Proxy** (free Cloudflare account, Node 20+ installed):
   ```
   cd worker
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler deploy
   ```
   `ALLOWED_ORIGINS` in `worker/wrangler.toml` is already set to `https://jewel123-prog.github.io`. Change it if your Pages address differs (scheme + host only, no path). Copy the worker URL it prints.
2. **Tell the app where the proxy is**, either way:
   - edit `PROXY_URL` in `config.js` and commit, or
   - open the app once and paste the URL into the "One-time setup" card (saved on that device only).
3. **Front end**: Settings > Pages > Deploy from branch `main`, folder `/ (root)`.
4. On your phone open `https://jewel123-prog.github.io/PlantMeasure/` and choose "Add to Home Screen".

## Security notes
- The proxy only accepts requests from `ALLOWED_ORIGINS`, JPEG images up to about 4.5 MB, and a reference length between 0 and 1000 cm. The model prompt is fixed on the server; clients cannot send their own.
- Origin checks stop other websites, not scripts that fake the header. **Set a monthly spend limit on your API key** and add a Cloudflare rate-limiting rule (Security > WAF > Rate limiting) for the worker route.
- CSV export neutralizes spreadsheet formula injection.

## Accuracy tips
- Put the reference object in the same plane as the plant part and shoot straight-on.
- The reference must span at least 5% of the photo's longer side, otherwise sizes are withheld.
- Leaf area = `SHAPE_FACTOR` x length x width (default 0.7). Calibrate it per species in `config.js`.
- Each CSV row records the model, app version, reference and shape factor so results can be reproduced and reported.

## Development
```
npm test        # unit tests
npm run check   # syntax checks
```
Run the site locally with any static server, e.g. `python3 -m http.server`.

## Licence
Apache-2.0, see `LICENSE`.
