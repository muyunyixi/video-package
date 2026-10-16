// Renders cover pages to PNG at a pixel ratio of 2 (2160×2880); cover/finish.py scales them to 1080×1440.
// usage: node cover/shoot.mjs window,moon,forme [outdir]
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const names = process.argv[2].split(",");
const out = process.argv[3] ?? "/home/claude/zxs/out/cover/drafts";
fs.mkdirSync(out, { recursive: true });
const root = "/home/claude";
const types = { ".html": "text/html", ".js": "text/javascript", ".otf": "font/otf", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
for (const n of names) {
  // 3:4 (1080×1440), or 4:3 (1440×1080) when the name carries ar=43
  const wide = /(^|&)ar=43(&|$)/.test(n);
  const page = await browser.newPage({ viewport: wide ? { width: 1440, height: 1080 } : { width: 1080, height: 1440 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
  // a name may carry the scene's own parameters: gaozhi&body=script → ?scene=gaozhi&body=script,
  // saved as gaozhi_body-script_x2.png
  await page.goto(`http://localhost:${port}/zxs/cover/index.html?scene=${n}`);
  await page.waitForFunction(() => window.coverReady === true, null, { timeout: 300000 });
  const file = path.join(out, `${n.replace(/&/g, "_").replace(/=/g, "-")}_x2.png`);
  await page.locator("#c").screenshot({ path: file, type: "png", timeout: 300000 });
  const info = await page.evaluate(() => window.__type);
  console.log(n, "->", file, JSON.stringify(info));
  await page.close();
}
await browser.close();
server.close();
process.exit(0);
