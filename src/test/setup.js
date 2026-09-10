// Общая подготовка для всех тестов. Подключается через test.setupFiles.
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

/**
 * Node 26 объявляет собственные localStorage/sessionStorage на globalThis, и
 * без флага `--localstorage-file` они возвращают undefined. В jsdom-окружении
 * vitest `window === globalThis`, поэтому геттер ноды перекрывает реализацию
 * jsdom — и код, который просто пишет `localStorage.getItem(...)`, падает с
 * «Cannot read properties of undefined».
 *
 * Свойство configurable, поэтому подменяем его рабочей реализацией. Ставим
 * ровно то поведение Web Storage, на которое рассчитывает код приложения:
 * значения приводятся к строкам, отсутствующий ключ даёт null.
 */
const createStorage = () => {
  let map = new Map();
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    clear: () => { map = new Map(); },
  };
};

for (const name of ["localStorage", "sessionStorage"]) {
  if (globalThis[name] == null) {
    Object.defineProperty(globalThis, name, {
      value: createStorage(),
      configurable: true,
      writable: true,
    });
  }
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  // Размонтируем дерево: без этого следующий тест увидит разметку предыдущего
  // и getByText начнёт находить по два элемента.
  cleanup();
});
