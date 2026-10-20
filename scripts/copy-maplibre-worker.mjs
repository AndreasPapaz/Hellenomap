// MapLibre v6 resolves its web worker relative to its own module URL, which breaks once
// Next bundles it. Serve the self-contained worker from /public instead (see MapView.tsx).
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs");
