// Библиотеки для сцен с demo.runtime (формат — int-server utils/questionBank/demo.js):
//  react — React 18 UMD: window.React, window.ReactDOM (без JSX: React.createElement);
//  vue   — Vue 3 runtime без компилятора шаблонов: window.Vue, разметка через h().
// Код берётся из своего бандла (vite alias @demo-runtime/* → node_modules, ?raw) и
// вставляется в srcdoc текстом: CSP сцены не меняется, сеть закрыта, eval не нужен.
// Грузится лениво — отдельный чанк только при первой такой сцене.
// Файл одинаковый в internship-admin и candidates.
const LOADERS = {
  react: () => Promise.all([import("@demo-runtime/react?raw"), import("@demo-runtime/react-dom?raw")])
    .then(([r, d]) => `${r.default}\n;${d.default}`),
  vue: () => import("@demo-runtime/vue?raw").then((m) => m.default),
};

const cache = new Map();

export function loadRuntime(name) {
  if (!name) return Promise.resolve("");
  const load = LOADERS[name];
  if (!load) return Promise.reject(new Error(`Неизвестный runtime сцены: ${name}`));
  if (!cache.has(name)) cache.set(name, load().catch((e) => { cache.delete(name); throw e; }));
  return cache.get(name);
}
