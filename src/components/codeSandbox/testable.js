// Какие редакторы проверяются автотестами (этап 6): чистый JS и HTML-документ в нашей
// песочнице. Sandpack (React/Vue/Tailwind) — нет. Отдельный крошечный модуль, как runnable.js:
// основной бандл не тянет раннер и парсер ради одной проверки.
// ⚠ Часть ядра песочницы (копия в admin; хеш в sync.test.js). Список = TESTABLE в tests.js.
export const TESTABLE = new Set(["js", "web"]);
export const canTest = (editor) => TESTABLE.has(editor);
