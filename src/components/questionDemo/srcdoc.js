// Сборка srcdoc живой сцены. Чистые функции — проверяются node --test.
//
// Безопасность (сцена — HTML из банка, рендерится у админа и у кандидата):
//  • iframe sandbox="allow-scripts" БЕЗ allow-same-origin (см. SANDBOX):
//    opaque origin — нет доступа к родителю, cookie, localStorage, токенам;
//  • первым элементом <head> — CSP без сети: сцена не может ничего загрузить
//    или отправить. Meta-CSP автора, идущий позже, может только сузить права;
//  • конфиг сценария кладётся в <script type="application/json"> с
//    экранированием "<", поэтому строка в шаге не закроет тег.
import { sceneRuntime } from "./runtime.js";

export const SANDBOX = "allow-scripts";
export const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
  "img-src data:; font-src data:; media-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
export const SLIDER = { min: 375, max: 1440, presets: [375, 768, 1440] };

const BASE_CSS =
  "*,*::before,*::after{box-sizing:border-box}html,body{margin:0}" +
  "body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0f172a;background:#fff}";

// JSON внутри <script>: "<" → \u003c, плюс разделители строк JS.
export function safeJson(value) {
  return JSON.stringify(value ?? null)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Код библиотеки внутри <script>: ни "</script", ни "<!--" (особые состояния
// HTML-парсера внутри script) не должны встретиться в тексте как есть.
export function safeScript(code) {
  return String(code || "").replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

// CSS внутри <style>: автор не должен закрыть тег.
export function safeCss(css) {
  return String(css || "").replace(/<\/style/gi, "<\\/style");
}

// Вариант сцены: исходная или «после исправления».
// fix.html заменяет html, fix.css ДОПИСЫВАЕТСЯ после css (переопределяет),
// fix.steps заменяет сценарий; подпись — своя.
export function resolveVariant(demo, fix, showFix) {
  if (!demo) return null;
  if (!showFix || !fix) {
    return { html: demo.html || "", css: demo.css || "", steps: demo.steps || [], caption: demo.caption, captionRu: demo.captionRu };
  }
  return {
    html: fix.html && fix.html.trim() ? fix.html : demo.html || "",
    css: `${demo.css || ""}\n/* fix */\n${fix.css || ""}`,
    steps: Array.isArray(fix.steps) ? fix.steps : demo.steps || [],
    caption: fix.caption || demo.caption,
    captionRu: fix.captionRu || demo.captionRu,
  };
}

export function localizedCaption(variant, lang) {
  if (!variant) return "";
  return (lang === "ru" && variant.captionRu) || variant.caption || variant.captionRu || "";
}

// runtimeCode — библиотека сцены (runtimes.js), идёт в <head> до html автора.
export function buildSrcdoc({ html = "", css = "", steps = [], autoplay = false, runtimeCode = "" } = {}) {
  const cfg = { steps: Array.isArray(steps) ? steps : [], autoplay: !!autoplay };
  return (
    "<!doctype html><html><head>" +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<style>${BASE_CSS}</style><style>${safeCss(css)}</style>` +
    (runtimeCode ? `<script>${safeScript(runtimeCode)}</script>` : "") +
    "</head><body>" +
    String(html || "") +
    `<script type="application/json" id="__demo_cfg">${safeJson(cfg)}</script>` +
    `<script>(${sceneRuntime.toString()})();</script>` +
    "</body></html>"
  );
}

// Масштаб: сцена живёт в своей ширине (media queries честные), а на экран
// ужимается под контейнер.
export function fitScale(sceneWidth, containerWidth) {
  if (!sceneWidth || !containerWidth) return 1;
  return Math.min(1, containerWidth / sceneWidth);
}

export function clampWidth(w) {
  const n = Math.round(Number(w) || SLIDER.max);
  return Math.min(SLIDER.max, Math.max(SLIDER.min, n));
}
