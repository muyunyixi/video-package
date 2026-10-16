// The film's source as its code coda lists it (scenes/Ending.tsx: the same tokens and colours), for the
// covers that set it: Chinese in the monospace two columns to a character, its ink on the two columns'
// axis (《字体处理规范》三 9). The coda's own code is not imported: src/ stays as the film shows it.
import source from "../src/gen/source.json";

export type Cls = "kw" | "str" | "zh" | "tpl" | "com" | "num" | "id" | "pun";
// the coda's colours (Ending.tsx COL)
export const COL: Record<Cls, string> = {
  kw: "#22325a",
  str: "#8e4e3e",
  zh: "#b32d27",
  tpl: "#5c6480",
  com: "#8f8a81",
  num: "#7c4c1e",
  id: "#1f1e23",
  pun: "#4f4c52",
};
export type Run = { text: string; col: number; cls: Cls; cjk: boolean };
export type Row = { kind: "file" | "code"; n: number; text: string; runs: Run[] };

const KW = new Set(
  "import from export const let var function return if else for of in new type interface as await async while break continue switch case default true false null undefined void typeof class extends this".split(" ")
);
export const isCJK = (ch: string) => /[—·…　-〿㐀-鿿＀-￯“”]/.test(ch);
const width = (ch: string) => (isCJK(ch) ? 2 : 1);

function pushRuns(out: Run[], text: string, col: number, cls: Cls) {
  let cur = "", cj = false, c0 = col;
  for (const ch of text) {
    const k = isCJK(ch);
    if (cur && k !== cj) {
      out.push({ text: cur, col: c0, cls, cjk: cj });
      cur = "";
    }
    if (!cur) {
      cj = k;
      c0 = col;
    }
    cur += ch;
    col += width(ch);
  }
  if (cur) out.push({ text: cur, col: c0, cls, cjk: cj });
  return col;
}

/** one file of the film's source, tokenized as the coda tokenizes it; a header row first */
export function fileRows(path: string): Row[] {
  const file = (source.files as { path: string; lines: string[] }[]).find((f) => f.path === path);
  if (!file) throw new Error(`no ${path} in source.json`);
  const out: Row[] = [{ kind: "file", n: 0, text: file.path, runs: [{ text: file.path, col: 0, cls: "com", cjk: false }] }];
  let tpl = false, block = false;
  file.lines.forEach((line, li) => {
    const runs: Run[] = [];
    let col = 0, i = 0;
    const chars = [...line];
    const take = (j: number, cls: Cls) => {
      col = pushRuns(runs, chars.slice(i, j).join(""), col, cls);
      i = j;
    };
    while (i < chars.length) {
      const ch = chars[i];
      if (block) {
        let j = i;
        while (j < chars.length && !(chars[j] === "*" && chars[j + 1] === "/")) j++;
        if (j < chars.length) {
          j += 2;
          block = false;
        }
        take(j, "com");
      } else if (tpl) {
        let j = i;
        while (j < chars.length && chars[j] !== "`") j += chars[j] === "\\" ? 2 : 1;
        if (j < chars.length) {
          j++;
          tpl = false;
        }
        take(Math.min(j, chars.length), "tpl");
      } else if (ch === "/" && chars[i + 1] === "/") take(chars.length, "com");
      else if (ch === "/" && chars[i + 1] === "*") {
        block = true;
        take(i + 2, "com");
      } else if (ch === "`") {
        tpl = true;
        take(i + 1, "tpl");
      } else if (ch === '"' || ch === "'") {
        let j = i + 1;
        while (j < chars.length && chars[j] !== ch) j += chars[j] === "\\" ? 2 : 1;
        j = Math.min(j + 1, chars.length);
        const body = chars.slice(i, j);
        if (body.some(isCJK)) {
          take(i + 1, "str");
          take(j - 1, "zh");
          take(j, "str");
        } else take(j, "str");
      } else if (/[A-Za-z_$]/.test(ch)) {
        let j = i;
        while (j < chars.length && /[\w$]/.test(chars[j])) j++;
        take(j, KW.has(chars.slice(i, j).join("")) ? "kw" : "id");
      } else if (/\d/.test(ch)) {
        let j = i;
        while (j < chars.length && /[\d._xa-fA-F]/.test(chars[j])) j++;
        take(j, "num");
      } else if (ch === " ") {
        let j = i;
        while (j < chars.length && chars[j] === " ") j++;
        col += j - i;
        i = j;
      } else take(i + 1, isCJK(ch) ? "zh" : "pun");
    }
    out.push({ kind: "code", n: li + 1, text: line, runs });
  });
  return out;
}

/** each row broken at `cols` columns (a Chinese character is never split); the rest of a long line
 *  goes on under it, indented by `hang` columns past the line's own indent */
export function wrap(rows: Row[], cols: number, hang = 4): Row[] {
  const out: Row[] = [];
  for (const row of rows) {
    // the row as cells
    const cells: { ch: string; col: number; cls: Cls; cjk: boolean }[] = [];
    for (const r of row.runs) {
      let c = r.col;
      for (const ch of r.text) {
        cells.push({ ch, col: c, cls: r.cls, cjk: r.cjk });
        c += r.cjk ? 2 : 1;
      }
    }
    if (!cells.length) {
      out.push(row);
      continue;
    }
    const indent = cells[0].col;
    let shift = 0, first = true, part: typeof cells = [];
    const flush = () => {
      const runs: Run[] = [];
      for (const c of part) {
        const last = runs[runs.length - 1];
        const col = c.col - shift;
        if (last && last.cls === c.cls && last.cjk === c.cjk && last.col + [...last.text].length * (c.cjk ? 2 : 1) === col) last.text += c.ch;
        else runs.push({ text: c.ch, col, cls: c.cls, cjk: c.cjk });
      }
      out.push({ kind: row.kind, n: first ? row.n : 0, text: "", runs });
      first = false;
      part = [];
    };
    for (const c of cells) {
      const w = c.cjk ? 2 : 1;
      if (c.col - shift + w > cols && part.length) {
        flush();
        // the next piece starts under the line's indent, plus the hang; spaces at a break are dropped
        shift = c.col - (indent + hang);
      }
      if (!part.length && c.ch === " ") continue;
      part.push(c);
    }
    if (part.length) flush();
  }
  return out;
}
