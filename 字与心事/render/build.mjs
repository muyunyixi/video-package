import esbuild from "/opt/npm-tools/node_modules/esbuild/lib/main.js";
import { genSource } from "./gen_source.mjs";
import { execFileSync } from "node:child_process";

const R = "/home/claude/vendor/remotion/packages";
const T = "/home/claude/vendor/three";

const t0 = Date.now();
// the coda shows the film's own source: snapshot it twice so the listing
// includes the final text of the file that renders it
genSource();
console.log(`source lines: ${genSource()}`);
// v4.5: 汇文明朝体's exact metrics for every character in the source (lib/ink: glyphInk)
execFileSync("python3", ["/home/claude/zxs/render/hw_metrics.py"], { stdio: "inherit" });
await esbuild.build({
  entryPoints: ["/home/claude/zxs/render/entry.tsx"],
  bundle: true,
  outfile: "/home/claude/zxs/out/bundle.js",
  format: "iife",
  jsx: "automatic",
  target: "chrome120",
  define: { "process.env.NODE_ENV": '"production"' },
  minify: false,
  sourcemap: false,
  logLevel: "error",
  loader: { ".json": "json" },
  tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
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
console.log(`bundle ok in ${Date.now() - t0} ms`);
