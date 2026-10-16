// Snapshot the film's own source, in film order, for the code coda.
import fs from "node:fs";
import path from "node:path";

const SRC = "/home/claude/zxs/src";
export const ORDER = [
  "scenes/typing.ts",
  "scenes/title.ts",
  "scenes/thread.ts",
  "scenes/inkheart.ts",
  "scenes/spring.ts",
  "scenes/clock.ts",
  "scenes/Chat.tsx",
  "scenes/Rewrite.tsx",
  "scenes/moon.ts",
  "scenes/Reply.tsx",
  "scenes/city.ts",
  "Video.tsx",
  "HUD.tsx",
  "Poem.tsx",
  "Vertical.tsx",
  "corpus.ts",
  "lib/util.ts",
  "lib/ink.ts",
  "lib/seep.tsx",
  "lib/glyph.ts",
  "lib/textures.ts",
  "lib/post.ts",
  "lib/ThreeLayer.tsx",
  "lib/sdf.ts",
  "lib/birds.ts",
  "lib/paint.ts",
  "lib/woodblock.ts",
  "scenes/Ending.tsx",
];

export function genSource() {
  const files = ORDER.filter((p) => fs.existsSync(path.join(SRC, p))).map((p) => {
    const text = fs.readFileSync(path.join(SRC, p), "utf8").replace(/\r/g, "").replace(/\t/g, "  ");
    const lines = text.split("\n");
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return { path: p, lines };
  });
  fs.mkdirSync(path.join(SRC, "gen"), { recursive: true });
  const out = path.join(SRC, "gen", "source.json");
  const json = JSON.stringify({ files });
  // only rewrite when changed (keeps rebuilds stable)
  if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== json) fs.writeFileSync(out, json);
  return files.reduce((n, f) => n + f.lines.length, 0);
}
