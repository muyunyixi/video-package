// Bundles the cover page (cover/app.tsx) with the film's libraries, as render/build.mjs does the film.
import esbuild from "/opt/npm-tools/node_modules/esbuild/lib/main.js";
const T = "/home/claude/vendor/three";
await esbuild.build({
  entryPoints: ["/home/claude/zxs/cover/app.tsx"],
  bundle: true,
  outfile: "/home/claude/zxs/out/cover/app.js",
  format: "iife",
  jsx: "automatic",
  target: "chrome120",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "error",
  loader: { ".json": "json" },
  tsconfigRaw: { compilerOptions: { jsx: "react-jsx" } },
  alias: {
    react: "/opt/npm-tools/node_modules/react",
    "react-dom": "/opt/npm-tools/node_modules/react-dom",
    three: `${T}/build/three.module.js`,
    "three/addons": `${T}/examples/jsm`,
  },
});
console.log("cover bundle ok");
