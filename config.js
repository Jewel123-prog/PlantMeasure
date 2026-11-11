// PlantMeasure settings.
// PROXY_URL: the URL of your deployed Cloudflare Worker (see README, step 1).
//   Leave empty to be asked for it once inside the app (stored on this device only).
// SHAPE_FACTOR: leaf area ~ SHAPE_FACTOR x length x width. Calibrate per species (default 0.7).
window.PM_CONFIG = {
  PROXY_URL: "",
  SHAPE_FACTOR: 0.7
};
