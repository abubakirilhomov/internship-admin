// Какие редакторы запускаются в песочнице (превью + консоль). Отдельный крошечный
// модуль: основной бандл проверяет canRun, не подтягивая парсер и prelude.
// jsx / vue / html / node — пока только подсветка (Sandpack — этап 5).
export const RUNNABLE = new Set(["web", "js"]);
export const canRun = (editor) => RUNNABLE.has(editor);
