// Какие редакторы запускаются в песочнице (превью + консоль). Отдельный крошечный
// модуль: основной бандл проверяет canRun, не подтягивая парсер и prelude.
// web / js — свой iframe-runner (runner.js); jsx / vue / tailwind — Sandpack (sandpack.js);
// html / node — пока только подсветка.
export const RUNNABLE = new Set(["web", "js"]);
export const SANDPACK = new Set(["jsx", "vue", "tailwind"]);
export const canRun = (editor) => RUNNABLE.has(editor) || SANDPACK.has(editor);
export const usesSandpack = (editor) => SANDPACK.has(editor);
