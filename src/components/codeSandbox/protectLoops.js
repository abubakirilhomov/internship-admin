// Защита от бесконечных циклов в коде кандидата.
//
// Зачем: песочница (iframe без allow-same-origin) в Chromium обычно живёт в
// том же процессе, что и страница: `while (true) {}` вешает всю вкладку —
// у кандидата и, что хуже, у интервьюера посреди собеседования (проверено в
// runner.browser.test.js). Поэтому в начало тела каждого цикла вставляется
// вызов сторожа GUARD (его определяет prelude): если синхронный код крутится
// дольше лимита, сторож бросает ошибку, и цикл прерывается.
//
// Разбор — @lezer/javascript (он уже есть в бандле вместе с CodeMirror).
// Вставки не добавляют переводов строк, поэтому номера строк в ошибках
// совпадают с кодом кандидата. Если парсер видит синтаксическую ошибку —
// код не трогаем: браузер всё равно покажет SyntaxError и ничего не запустит.
import { parser } from "@lezer/javascript";

export const GUARD = "__marsLoopGuard";
const LOOPS = new Set(["ForStatement", "WhileStatement", "DoStatement"]);

function loopBody(node) {
  const kids = [];
  for (let c = node.firstChild; c; c = c.nextSibling) kids.push(c);
  if (node.name === "DoStatement") return kids.find((c, i) => i > 0 && c.name !== "do") || null;
  // for/while: тело — последний ребёнок после «)»
  const close = kids.map((c) => c.name).lastIndexOf(")");
  const rest = kids.slice(close + 1);
  return rest.length ? rest[rest.length - 1] : null;
}

export function protectLoops(code, { dialect = "" } = {}) {
  const src = String(code ?? "");
  if (!src.includes("for") && !src.includes("while")) return src;
  let tree;
  try {
    tree = (dialect ? parser.configure({ dialect }) : parser).parse(src);
  } catch {
    return src;
  }
  let broken = false;
  const edits = []; // [pos, text]
  let id = 0;
  tree.iterate({
    enter(n) {
      if (n.type.isError) { broken = true; return false; }
      if (!LOOPS.has(n.name)) return undefined;
      const body = loopBody(n.node);
      if (!body) return undefined;
      id += 1;
      const call = `${GUARD}(${id});`;
      if (body.name === "Block") edits.push([body.from + 1, call]);
      else {
        edits.push([body.from, `{${call}`]);
        edits.push([body.to, "}"]);
      }
      return undefined;
    },
  });
  if (broken || !edits.length) return src;
  // с конца, чтобы позиции не сдвигались; при равной позиции «}» ставим раньше «{»
  edits.sort((a, b) => b[0] - a[0] || (a[1] === "}" ? -1 : 1));
  let out = src;
  for (const [pos, text] of edits) out = out.slice(0, pos) + text + out.slice(pos);
  return out;
}
