#!/usr/bin/env node
// Минифицированный прод-стек → строки исходника.
//
// Зачем: keepNames даёт имя компонента, но не место. Без карт агент-починщик
// видит `index-BlocWOTr.js:1:284729` и не знает, куда смотреть.
//
//   node symbolize.mjs <dir-с-.map> [файл-со-стеком]     (без файла — читает stdin)
//
// Node-овский SourceMap из node:module на бандлах Vite молча возвращает пусто,
// поэтому берём @jridgewell/trace-mapping — он уже стоит как зависимость Vite.

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { createRequire } from "node:module";

const [, , mapDir, stackArg] = process.argv;
if (!mapDir) {
  console.error("нужно: symbolize.mjs <dir-с-.map> [файл-со-стеком]");
  process.exit(2);
}

const require = createRequire(join(process.cwd(), "package.json"));
let TraceMap, originalPositionFor;
try {
  ({ TraceMap, originalPositionFor } = require("@jridgewell/trace-mapping"));
} catch {
  console.error("нет @jridgewell/trace-mapping — запускай из каталога проекта, где он в node_modules");
  process.exit(2);
}

const files = readdirSync(mapDir).filter((f) => f.endsWith(".map"));
const cache = new Map();               // карты грузим лениво: главная весит 7+ МБ
const mapFor = (js) => {
  if (cache.has(js)) return cache.get(js);
  const hit = files.find((f) => f === `${js}.map`);
  let tm = null;
  if (hit) {
    try { tm = new TraceMap(JSON.parse(readFileSync(join(mapDir, hit), "utf8"))); }
    catch (e) { console.error(`не разобрал ${hit}: ${e.message}`); }
  }
  cache.set(js, tm);
  return tm;
};

const raw = stackArg ? readFileSync(stackArg, "utf8") : readFileSync(0, "utf8");
const FRAME = /(?:at\s+([^\s(]+)\s+\()?([^\s()]*?[^\s()/]+\.js):(\d+):(\d+)\)?/;

let ok = 0, total = 0, noMap = 0;
for (const line of raw.split("\n")) {
  const m = line.match(FRAME);
  if (!m) { if (line.trim()) console.log(line); continue; }
  total++;
  const [, fn, path, l, c] = m;
  const tm = mapFor(basename(path));
  if (!tm) {
    noMap++;
    console.log(`  ${fn || "?"}  →  ${path}:${l}:${c}   ⚠ карты нет`);
    continue;
  }
  const p = originalPositionFor(tm, { line: Number(l), column: Number(c) });
  if (p.source) {
    ok++;
    // Свой код важнее: node_modules в стеке почти всегда шум.
    const src = p.source.replace(/^.*?\/(src\/)/, "$1").replace(/^.*\/node_modules\//, "node_modules/");
    const own = src.startsWith("src/") ? "→" : " ";
    console.log(`  ${own} ${fn || p.name || "?"}  →  ${src}:${p.line}:${p.column}`);
  } else {
    console.log(`  ${fn || "?"}  →  ${path}:${l}:${c}   ⚠ позиция не легла на карту`);
  }
}
console.error(`\nкадров: ${total}, разобрано ${ok}` + (noMap ? `, без карты ${noMap}` : ""));
