// Sandpack (этап 5): React / Vue / Vue + Tailwind v4 через бандлер CodeSandbox.
// Чистые функции без React — проверяются node --test.
//
// ⚠ Файл — ОДИН И ТОТ ЖЕ в candidates/src/lib/sandbox и internship-admin/src/components/codeSandbox
// (sync.test.js сверяет хеш), как остальное ядро песочницы.
//
// Безопасность. Превью живёт в iframe на чужом домене (бандлер CodeSandbox): у него
// другой origin, поэтому код кандидата не читает ни storage приложения (токены),
// ни DOM родителя. Родителю разрешён ТОЛЬКО этот хост (frame-src в vercel.json);
// sandbox iframe — минимальный: без popups, top-navigation, modals, downloads.
// allow-same-origin относится к origin бандлера (он нужен бандлеру), не к нашему.

// Версия клиента Sandpack зашита в хост бандлера: тест сверяет его с package.json
// и с frame-src в vercel.json — обновили пакет, обновите и то и другое.
export const BUNDLER_VERSION = "2.19.8";
export const BUNDLER_HOST = `${BUNDLER_VERSION.replace(/\./g, "-")}-sandpack.codesandbox.io`;
export const BUNDLER_URL = `https://${BUNDLER_HOST}/`;
export const SANDPACK_IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms";
// Tailwind v4 в браузере: сканирует классы в DOM превью (без сборки). Грузится внутри iframe.
export const TAILWIND_BROWSER_URL = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4";

export { SANDPACK as SANDPACK_EDITORS, usesSandpack } from "./runnable.js";

const REACT_VERSION = "^18.3.1";
const VUE_VERSION = "^3.4.0";

const REACT_INDEX = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")).render(<App />);
`;

const REACT_HOOKS = "useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext";

// Кандидат пишет компонент как на собеседовании: без import и export default.
// Нормализуем так, чтобы номера СТРОК не сдвигались: добавки — в начало первой
// строки (одной строкой) и в конец файла.
export function normalizeJsx(code) {
  let src = String(code ?? "");
  if (!src.trim()) return "export default function App() { return null; }\n";
  if (!/from\s*['"]react['"]/.test(src)) src = `import React, { ${REACT_HOOKS} } from "react"; ${src}`;
  if (!/export\s+default\b/.test(src)) {
    const names = [...src.matchAll(/(?:^|[\n;}])\s*(?:function|const|let|var|class)\s+([A-Z][A-Za-z0-9_]*)/g)];
    const name = names.length ? names[names.length - 1][1] : null;
    if (name) src += `\nexport default ${name};\n`;
  }
  return src;
}

// Vue: SFC как есть; голая разметка (без <template>/<script>/<style>) заворачивается в <template>.
// SFC без <script> бандлер Sandpack не обновляет при правке (проверено: превью остаётся старым),
// поэтому в КОНЕЦ такого файла добавляется пустой компонент — номера строк не сдвигаются,
// конфликта нет (своего <script> у кандидата нет).
const EMPTY_SCRIPT = "\n<script>\nexport default {};\n</script>\n";
export function normalizeVue(code) {
  const src = String(code ?? "");
  if (!src.trim()) return `<template><div></div></template>${EMPTY_SCRIPT}`;
  const sfc = /<\s*(template|script|style)\b/i.test(src) ? src : `<template>${src}</template>`;
  return /<\s*script\b/i.test(sfc) ? sfc : sfc.replace(/\n*$/, "") + EMPTY_SCRIPT;
}

/**
 * Настройка Sandpack под editor. → { template, files, dependencies, externalResources }.
 * Код кандидата — единственный изменяемый файл (App.js / App.vue), как в ответе.
 */
export function sandpackSetup(editor, code) {
  if (editor === "jsx") {
    return {
      template: "react",
      files: {
        "/App.js": { code: normalizeJsx(code) },
        // Без StrictMode: он дважды вызывает рендер и дублирует console.log — кандидат решит, что ошибся.
        "/index.js": { code: REACT_INDEX, hidden: true },
      },
      dependencies: { react: REACT_VERSION, "react-dom": REACT_VERSION },
      externalResources: [],
    };
  }
  if (editor === "vue" || editor === "tailwind") {
    return {
      template: "vue",
      files: { "/src/App.vue": { code: normalizeVue(code) } },
      dependencies: { vue: VUE_VERSION },
      externalResources: editor === "tailwind" ? [TAILWIND_BROWSER_URL] : [],
    };
  }
  throw new Error(`Нет шаблона Sandpack для ${editor}`);
}

// Сообщение консоли бандлера (message.log[]) → строки {level, text}.
const METHOD_LEVEL = { log: "log", info: "info", debug: "log", warn: "warn", error: "error", assert: "error" };
export function formatConsoleData(data) {
  const one = (v) => {
    if (typeof v === "string") return v;
    if (v === undefined) return "undefined";
    try {
      const s = JSON.stringify(v);
      return s === undefined ? String(v) : s;
    } catch { return String(v); }
  };
  return (Array.isArray(data) ? data : [data]).map(one).join(" ");
}
export function consoleEntries(message) {
  const out = [];
  for (const l of Array.isArray(message?.log) ? message.log : []) {
    if (l?.method === "clear") { out.push({ clear: true }); continue; }
    const level = METHOD_LEVEL[l?.method];
    if (!level) continue;
    out.push({ level, text: formatConsoleData(l.data).slice(0, 5000) });
  }
  return out;
}
