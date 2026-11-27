// node --test: чистые функции Sandpack (без браузера) и согласованность версии/CSP.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BUNDLER_HOST, BUNDLER_URL, BUNDLER_VERSION, SANDPACK_IFRAME_SANDBOX, TAILWIND_BROWSER_URL,
  consoleEntries, formatConsoleData, normalizeJsx, normalizeVue, sandpackSetup, usesSandpack,
} from "./sandpack.js";
import { canRun } from "./runnable.js";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

test("какие редакторы идут в Sandpack", () => {
  for (const e of ["jsx", "vue", "tailwind"]) { assert.ok(usesSandpack(e)); assert.ok(canRun(e)); }
  for (const e of ["web", "js"]) { assert.ok(!usesSandpack(e)); assert.ok(canRun(e)); }
  for (const e of ["html", "node", undefined, null]) { assert.ok(!usesSandpack(e)); assert.ok(!canRun(e)); }
});

test("normalizeJsx: компонент без import и export default запускается; номера строк не сдвигаются", () => {
  const src = "function Counter() {\n  const [c, setC] = useState(0);\n  return <b>{c}</b>;\n}";
  const out = normalizeJsx(src);
  assert.match(out, /^import React, \{ useState,/);
  assert.match(out, /export default Counter;\n$/);
  // добавка — в начало ПЕРВОЙ строки: строка 3 кода остаётся строкой 3
  assert.equal(out.split("\n")[2], "  return <b>{c}</b>;");
  assert.equal(out.split("\n")[0].endsWith("function Counter() {"), true);
});

test("normalizeJsx: уже полный файл не трогаем; последний компонент становится default; пустой — заглушка", () => {
  const full = 'import { useState } from "react";\nexport default function App() { return null; }';
  assert.equal(normalizeJsx(full), full);
  const two = "const helper = 1;\nfunction A() { return null; }\nconst B = () => <i />;";
  assert.match(normalizeJsx(two), /export default B;/);
  assert.match(normalizeJsx("   "), /export default function App/);
  assert.match(normalizeJsx(undefined), /export default function App/);
  // нечего экспортировать (нет компонента) — не выдумываем
  assert.ok(!/export default/.test(normalizeJsx("const x = 1;")));
});

test("normalizeVue: SFC как есть, голая разметка → <template>, пустое → заглушка", () => {
  const sfc = "<script setup>\nconst a = 1;\n</script>\n<template><b/></template>";
  assert.equal(normalizeVue(sfc), sfc);
  assert.equal(normalizeVue('<div class="p-4">x</div>'), '<template><div class="p-4">x</div></template>\n');
  assert.match(normalizeVue(""), /<template>/);
  const onlyScript = "<script setup>const a = 1;</script>";
  assert.equal(normalizeVue(onlyScript), onlyScript);
});

test("sandpackSetup: шаблоны, версии, Tailwind только у tailwind", () => {
  const r = sandpackSetup("jsx", "function A(){ return null; }");
  assert.equal(r.template, "react");
  assert.deepEqual(Object.keys(r.files).sort(), ["/App.js", "/index.js"]);
  assert.ok(!/StrictMode/.test(r.files["/index.js"].code), "без StrictMode: нет двойного console.log");
  assert.match(r.dependencies.react, /^\^18\./);
  assert.deepEqual(r.externalResources, []);

  const v = sandpackSetup("vue", "<template><b/></template>");
  assert.equal(v.template, "vue");
  assert.deepEqual(Object.keys(v.files), ["/src/App.vue"]);
  assert.match(v.dependencies.vue, /^\^3\.(4|[5-9])/, "Vue 3.4+");
  assert.deepEqual(v.externalResources, []);

  const t = sandpackSetup("tailwind", '<div class="p-4"/>');
  assert.equal(t.template, "vue");
  assert.deepEqual(t.externalResources, [TAILWIND_BROWSER_URL]);
  assert.match(TAILWIND_BROWSER_URL, /@tailwindcss\/browser@4$/);
  assert.match(t.files["/src/App.vue"].code, /^<template>/);

  assert.throws(() => sandpackSetup("web", ""), /Нет шаблона/);
});

test("консоль: сообщение бандлера → строки, clear, лимит длины, не-JSON значения", () => {
  const m = { log: [
    { method: "log", data: ["a", 1, { x: 2 }] },
    { method: "warn", data: ["w"] },
    { method: "error", data: ["boom"] },
    { method: "table", data: ["skip"] },
    { method: "clear" },
    { method: "log", data: [undefined] },
  ] };
  assert.deepEqual(consoleEntries(m), [
    { level: "log", text: 'a 1 {"x":2}' },
    { level: "warn", text: "w" },
    { level: "error", text: "boom" },
    { clear: true },
    { level: "log", text: "undefined" },
  ]);
  const circ = {}; circ.self = circ;
  assert.equal(formatConsoleData([circ]), "[object Object]");
  assert.equal(consoleEntries({ log: [{ method: "log", data: ["x".repeat(9000)] }] })[0].text.length, 5000);
  assert.deepEqual(consoleEntries(null), []);
  assert.deepEqual(consoleEntries({}), []);
});

test("хост бандлера = версия sandpack-client = frame-src в vercel.json; пакеты закреплены точно", () => {
  assert.equal(BUNDLER_URL, `https://${BUNDLER_HOST}/`);
  assert.equal(BUNDLER_HOST, `${BUNDLER_VERSION.replace(/\./g, "-")}-sandpack.codesandbox.io`);
  const client = JSON.parse(read("../../../node_modules/@codesandbox/sandpack-client/package.json"));
  assert.equal(client.version, BUNDLER_VERSION, "обновили пакет — обновите BUNDLER_VERSION и frame-src");
  const pkg = JSON.parse(read("../../../package.json"));
  assert.match(pkg.dependencies["@codesandbox/sandpack-react"], /^\d+\.\d+\.\d+$/, "версия без ^ — хост бандлера зашит в frame-src");
  const csp = JSON.parse(read("../../../vercel.json")).headers[0].headers.find((h) => h.key === "Content-Security-Policy").value;
  assert.ok(csp.includes(`frame-src https://${BUNDLER_HOST};`) || csp.includes(`frame-src https://${BUNDLER_HOST} `), "frame-src только бандлер");
  assert.ok(!/frame-src[^;]*\*/.test(csp), "без подстановочных хостов");
  assert.ok(csp.includes("frame-ancestors 'none'"), "своя страница не встраивается в чужой фрейм");
});

test("sandbox iframe: только скрипты, формы и origin бандлера", () => {
  assert.deepEqual(SANDPACK_IFRAME_SANDBOX.split(" ").sort(), ["allow-forms", "allow-same-origin", "allow-scripts"]);
});
