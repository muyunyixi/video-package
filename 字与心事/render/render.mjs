// Frame-accurate capture: seek the Remotion Player, wait for paint, screenshot.
// usage: node render.mjs --from 0 --to 600 [--step 1] [--jobs 1] [--out dir] [--q 94] [--frames 10,20,30]
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => (a.startsWith("--") ? [...acc, [a.slice(2), arr[i + 1]]] : acc), [])
);
const from = +(args.from ?? 0);
const to = +(args.to ?? 600);
const step = +(args.step ?? 1);
const jobs = +(args.jobs ?? 1);
const q = +(args.q ?? 94);
const out = args.out ?? "/home/claude/zxs/out/frames";
fs.mkdirSync(out, { recursive: true });
let frames = [];
if (args.frames) frames = args.frames.split(",").map(Number);
else for (let f = from; f < to; f += step) frames.push(f);
if (args.skip) frames = frames.filter((f) => !fs.existsSync(path.join(out, `f_${String(f).padStart(5, "0")}.jpg`)));
if (!frames.length) { console.log("nothing to render"); process.exit(0); }

const root = "/home/claude";
const types = { ".html": "text/html", ".js": "text/javascript", ".otf": "font/otf", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };
const server = http
  .createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
    fs.readFile(p, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(0);
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  // --tag marks this browser's command line, so a queue can clean up only its own processes
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-vsync", "--disable-frame-rate-limit", ...(args.tag ? [`--zxs-tag=${args.tag}`] : [])],
});

const chunks = Array.from({ length: jobs }, (_, j) => {
  const n = Math.ceil(frames.length / jobs);
  return frames.slice(j * n, (j + 1) * n);
});

const t0 = Date.now();
let done = 0;
await Promise.all(
  chunks.map(async (list, j) => {
    if (!list.length) return;
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.log(`[pageerror ${j}]`, e.message));
    page.on("console", (m) => {
      if (m.type() === "error") console.log(`[console ${j}]`, m.text().slice(0, 300));
    });
    if (args.flags) await page.addInitScript((fl) => { window.__flags = JSON.parse(fl); }, args.flags);
    await page.goto(`http://localhost:${port}/zxs/render/index.html${args.bundle ? `?b=${args.bundle}` : ""}`);
    try {
      await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
    } catch (e) {
      console.log(`[watchdog] page never ready`);
      process.exit(3);
    }
    const cdp = await page.context().newCDPSession(page);
    let tSeek = 0, tShot = 0;
    // watchdog: SwiftShader occasionally stalls; give up on this browser and let the queue retry
    const guard = (p, ms, what) =>
      Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT ${what}`)), ms)),
      ]).catch((e) => {
        console.log(`[watchdog] ${e.message}`);
        process.exit(3);
      });
    for (const f of list) {
      const a = Date.now();
      await guard(page.evaluate((f) => window.seek(f), f), Number(process.env.WATCHDOG_MS || 150000), `seek ${f}`);
      const b = Date.now();
      const { data } = await guard(cdp.send("Page.captureScreenshot", { format: "jpeg", quality: q, optimizeForSpeed: true }), 150000, `shot ${f}`);
      const c = Date.now();
      tSeek += b - a; tShot += c - b;
      if (args.verbose) console.log(`f${f} seek ${b - a} ms shot ${c - b} ms`);
      fs.writeFileSync(path.join(out, `f_${String(f).padStart(5, "0")}.jpg`), Buffer.from(data, "base64"));
      done++;
      if (done % 20 === 0 || done === frames.length) {
        const el = (Date.now() - t0) / 1000;
        console.log(`${done}/${frames.length}  ${(el / done).toFixed(2)} s/frame  elapsed ${el.toFixed(0)} s`);
      }
    }
    await page.close();
  })
);
await browser.close();
server.close();
console.log(`done ${frames.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
// a lingering keep-alive socket can hold the event loop open: leave explicitly
process.exit(0);
