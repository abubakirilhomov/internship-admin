// Песочница для кода кандидата (этап 4): сборка srcdoc. Чистые функции —
// проверяются node --test; поведение в браузере — runner.browser.test.js.
//
// ⚠ Этот каталог (runner.js, prelude.js, protectLoops.js, runnable.js) — ОДИН И ТОТ ЖЕ код в
// candidates/src/lib/sandbox и internship-admin/src/components/codeSandbox:
// интервьюер должен видеть ровно тот результат, что кандидат. Правите — правьте
// в обоих репозиториях (тест sameAsCandidate в админке сверяет хеш).
//
// Безопасность:
//  • iframe sandbox="allow-scripts allow-forms" БЕЗ allow-same-origin: непрозрачный
//    origin — нет доступа к родителю, его localStorage (токены), cookie; без
//    allow-popups / allow-top-navigation / allow-modals — ни окон, ни ухода
//    вкладки. allow-forms нужен, иначе событие submit вообще не срабатывает
//    (проверено в Chromium), а отправку формы всё равно режет form-action 'none';
//  • первым элементом <head> — CSP без сети (fetch, картинки, шрифты, WebSocket,
//    формы). Meta-CSP кандидата может только сузить права;
//  • уход iframe на чужой адрес (location = …, <a>, meta refresh) CSP документа
//    не ловит — его режет frame-src 'none' в CSP РОДИТЕЛЬСКОЙ страницы (vercel.json);
//  • WebRTC CSP не режет — заглушки в prelude;
//  • бесконечные циклы — protectLoops + сторож в prelude.
import { sandboxPrelude } from "./prelude.js";
import { GUARD, protectLoops } from "./protectLoops.js";

export const SANDBOX = "allow-scripts allow-forms";
export const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
  "img-src data:; font-src data:; media-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
export const LIMIT_MS = 2000;
// Ширина превью: auto — ширина колонки; остальное — как у телефона/планшета/ноутбука.
export const WIDTHS = [0, 375, 768, 1440];

export { RUNNABLE, canRun } from "./runnable.js";

const TEXTS = {
  uz: {
    tooMany: "… xabarlar juda ko'p, qolganlari yashirildi",
    rtc: "qum qutisida o'chirilgan",
    loop: "Sikl {s} soniyadan uzoq ishladi — to'xtatildi (cheksiz sikldan himoya)",
    nav: "Qum qutisida boshqa sahifaga o'tish o'chirilgan",
    net: "Qum qutisida tarmoq yopiq",
  },
  ru: {
    tooMany: "… слишком много сообщений, остальные скрыты",
    rtc: "в песочнице отключён",
    loop: "Цикл работает дольше {s} с — остановлен (защита от бесконечного цикла)",
    nav: "Переход на другую страницу в песочнице отключён",
    net: "Сеть в песочнице закрыта",
  },
};

// JSON внутри <script>: «<» экранируется, плюс разделители строк JS.
export function safeJson(value) {
  return JSON.stringify(value ?? null)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Код внутри <script>…</script>: только последовательность «</script» закрыла бы
// тег раньше времени. «<\/» в JS-строке, шаблоне и регэкспе означает то же «</».
export function escapeScript(code) {
  return String(code ?? "").replace(/<\/(script)/gi, "<\\/$1");
}

const JS_TYPES = new Set(["", "text/javascript", "application/javascript", "module", "text/ecmascript"]);

// Встроенные <script> в HTML кандидата — под защиту циклов. Внешние (src) всё
// равно не загрузятся (CSP), типы-шаблоны (text/template…) не трогаем.
export function protectHtmlScripts(html) {
  return String(html ?? "").replace(/(<script\b([^>]*)>)([\s\S]*?)(<\/script\s*>)/gi, (m, open, attrs, body, close) => {
    const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1] || "").toLowerCase();
    if (!JS_TYPES.has(type)) return m;
    return open + protectLoops(body) + close;
  });
}

export const count = (s, ch) => s.split(ch).length - 1;

export function head(cfg) {
  return (
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<script>(${sandboxPrelude.toString()})(${safeJson(cfg)});</script>`
  );
}

/**
 * Документ для iframe srcdoc.
 * @param editor  "web" — HTML-документ кандидата; "js" — чистый JS
 * @param code    текст ответа
 * @param runId   метка прогона: родитель отбрасывает сообщения прошлых прогонов
 * @param lang    uz | ru — язык служебных сообщений консоли
 */
export function buildRunDoc({ editor, code = "", runId = "run", lang = "uz", limitMs = LIMIT_MS } = {}) {
  const base = { runId: String(runId), guard: GUARD, limitMs, t: TEXTS[lang] || TEXTS.uz, lineOffset: 0 };
  const src = String(code ?? "");
  let before;
  let body;
  let lost = 0; // строки doctype кандидата, которые заменены нашим
  if (editor === "js") {
    before = (cfg) => `<!doctype html><html><head>${head(cfg)}</head><body><script>\n`;
    body = escapeScript(protectLoops(src)) + "\n</script></body></html>";
  } else {
    // Всегда стандартный режим: свой doctype первым, служебный <head> — сразу за
    // ним (парсер сам откроет html/head, теги кандидата <html>/<head> сольются).
    const doctype = /^\s*<!doctype[^>]*>/i.exec(src);
    const rest = doctype ? src.slice(doctype[0].length) : src;
    lost = doctype ? count(doctype[0], "\n") : 0;
    before = (cfg) => `<!doctype html>${head(cfg)}`;
    body = protectHtmlScripts(rest);
  }
  // Номер строки в ошибке = строка в srcdoc − строк служебной шапки.
  const lineOffset = count(before(base), "\n") - lost;
  return before({ ...base, lineOffset }) + body;
}
