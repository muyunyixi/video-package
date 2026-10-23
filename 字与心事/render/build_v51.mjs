// v5.1: the bundle as render/build.mjs makes it, frozen to out/bundle_v51.js, except that the source
// the coda shows (src/gen/source.json, imported by scenes/Ending.tsx) is v4.5's listing
// (audio/listing_v45.json). v5.1 re-renders frames of the ending (1966–2120: the lattice's shadow),
// and the frames after them (2121–2229) and the score's coda sound are v4.5's: so the listing behind
// the page must stay v4.5's too. src/gen/source.json itself is still written from the current source.
import esbuild from "/opt/npm-tools/node_modules/esbuild/lib/main.js";
import { genSource } from "./gen_source.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const R = "/home/claude/vendor/remotion/packages";
const T = "/home/claude/vendor/three";
const LISTING = "/home/claude/zxs/audio/listing_v45.json";
const OUT = process.argv[2] ?? "/home/claude/zxs/out/bundle_v51.js";

const t0 = Date.now();
genSource();
console.log(`source lines: ${genSource()}`);
execFileSync("python3", ["/home/claude/zxs/render/hw_metrics.py"], { stdio: "inherit" });
const listing = {
  name: "listing_v45",
  setup(b) {
    b.onLoad({ filter: /src[\\/]gen[\\/]source\.json$/ }, () => ({ contents: fs.readFileSync(LISTING, "utf8"), loader: "json" }));
  },
};
await esbuild.build({
  entryPoints: ["/home/claude/zxs/render/entry.tsx"],
  bundle: true,
  outfile: OUT,
  format: "iife",
  jsx: "automatic",
  target: "chrome120",
  define: { "process.env.NODE_ENV": '"production"' },
  minify: false,
  sourcemap: false,
  logLevel: "error",
  loader: { ".json": "json" },
  tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
  plugins: [listing],
  alias: {
    "remotion/no-react": `${R}/core/src/no-react.ts`,
    remotion: `${R}/core/src/index.ts`,
    "@remotion/player": `${R}/player/src/index.ts`,
    react: "/opt/npm-tools/node_modules/react",
    "react-dom": "/opt/npm-tools/node_modules/react-dom",
    three: `${T}/build/three.module.js`,
    "three/addons": `${T}/examples/jsm`,
  },
  external: ["zod", "zod/v3", "zod/v4/core"],
});
console.log(`bundle ok in ${Date.now() - t0} ms → ${OUT}`);
