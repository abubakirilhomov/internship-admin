// node --test: рантайм сцены в настоящем Chromium (headless). Синтетические сцены.
// Нужен playwright-core: PLAYWRIGHT_CORE=/путь/к/node_modules/playwright-core
// (и скачанный браузер). Без него тест пропускается.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import { SANDBOX, buildSrcdoc } from "./srcdoc.js";

let chromium = null;
try {
  const require = createRequire(import.meta.url);
  ({ chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core"));
} catch { /* нет playwright — пропуск */ }

const skip = chromium ? false : "нет playwright-core (PLAYWRIGHT_CORE)";
let browser;
let server;
let hits = 0;
let port = 0;

before(async () => {
  if (skip) return;
  server = http.createServer((req, res) => { hits += 1; res.end("x"); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  port = server.address().port;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
async function mount(scene, width = 600, height = 400) {
  const page = await browser.newPage({ viewport: { width: width + 40, height: height + 40 } });
  page.on("pageerror", () => {});
  await page.setContent(
    `<script>window.msgs=[];addEventListener("message",e=>msgs.push(e.data))</script>` +
    `<iframe id="f" sandbox="${SANDBOX}" style="width:${width}px;height:${height}px;border:0" srcdoc="${attr(buildSrcdoc(scene))}"></iframe>`
  );
  await page.waitForFunction(() => window.msgs.some((m) => m && m.type === "ready"));
  const frame = page.frames().find((f) => f !== page.mainFrame());
  return { page, frame };
}
const waitMsg = (page, type) => page.waitForFunction((t) => window.msgs.some((m) => m && m.type === t), type, { timeout: 15000 });

test("сеть закрыта: картинка, fetch, css-фон не уходят", { skip }, async () => {
  hits = 0;
  const url = `http://127.0.0.1:${port}`;
  const { page } = await mount({
    html: `<img src="${url}/a.png"><div class="bg">x</div><script>fetch("${url}/f").catch(()=>{})</script>`,
    css: `.bg{background:url(${url}/b.png)}`,
  });
  await page.waitForTimeout(700);
  assert.equal(hits, 0);
  await page.close();
});

test("родитель недоступен: ни DOM, ни cookie", { skip }, async () => {
  const { page } = await mount({
    html: `<script>
      let r = [];
      try { r.push(parent.document.title); } catch (e) { r.push("blocked"); }
      try { r.push(document.cookie); } catch (e) { r.push("nocookie"); }
      parent.postMessage({ __demo: true, type: "probe", r }, "*");
    </script>`,
  });
  await waitMsg(page, "probe");
  const probe = await page.evaluate(() => window.msgs.find((m) => m.type === "probe").r);
  assert.deepEqual(probe, ["blocked", "nocookie"]);
  await page.close();
});

const clickScene = (overlayCss) => ({
  html: `<button id="b" onclick="this.dataset.n=(+this.dataset.n||0)+1" data-n="0">Go</button><div id="ov"></div>`,
  css: `#b{position:absolute;left:40px;top:40px;width:120px;height:50px}
        #ov{position:absolute;left:0;top:0;width:300px;height:200px;opacity:0;${overlayCss}}`,
  steps: [{ type: "click", target: "#b" }],
  autoplay: true,
});

test("клик идёт в то, что реально сверху (невидимый слой перехватывает)", { skip }, async () => {
  let { page, frame } = await mount(clickScene(""));
  await waitMsg(page, "done");
  assert.equal(await frame.$eval("#b", (b) => b.dataset.n), "0");
  await page.close();
  ({ page, frame } = await mount(clickScene("pointer-events:none")));
  await waitMsg(page, "done");
  assert.equal(await frame.$eval("#b", (b) => b.dataset.n), "1");
  await page.close();
});

test("hover-атрибут, классы, прокрутка", { skip }, async () => {
  const { page, frame } = await mount({
    html: `<div id="c">card</div><div style="height:2000px"></div>`,
    css: `#c{width:100px;height:60px;background:#ddd}`,
    steps: [{ type: "hover", target: "#c" }, { type: "addClass", target: "#c", className: "open" },
      { type: "scroll", to: 300, ms: 200 }],
    autoplay: true,
  });
  await waitMsg(page, "done");
  assert.equal(await frame.$eval("#c", (c) => c.hasAttribute("data-hover") && c.classList.contains("open")), true);
  assert.equal(await frame.evaluate(() => Math.round(document.scrollingElement.scrollTop)), 300);
  await page.close();
});

test("3D-слои: уровни по реальному порядку отрисовки, не по z-index в CSS", { skip }, async () => {
  // .menu с z-index:9999 внутри карточки с opacity<1 (свой stacking context)
  // реально рисуется ПОД соседней карточкой.
  const { page, frame } = await mount({
    html: `<div class="card a" data-label="A"><div class="menu" data-label="menu"></div></div><div class="card b" data-label="B"></div>`,
    css: `.card{position:relative;width:200px;height:120px;margin:10px;background:#cbd5e1}
          .a{opacity:.99;z-index:1}.b{z-index:2;background:#94a3b8}
          .menu{position:absolute;left:20px;top:80px;width:150px;height:120px;background:#fca5a5;z-index:9999}`,
  });
  await page.evaluate(() => document.getElementById("f").contentWindow.postMessage({ __demo: true, type: "layers", on: true }, "*"));
  await waitMsg(page, "layers");
  const levels = await page.evaluate(() => window.msgs.find((m) => m.type === "layers").levels);
  assert.equal(levels, 3); // A → menu → B
  const order = await frame.evaluate(() => Array.from(document.querySelectorAll("[data-demo-ui] span")).map((s) => s.textContent));
  assert.deepEqual(order, ["A", "menu", "B"]);
  await page.close();
});

// ── runtime react | vue: та же библиотека, что вставляет runtimes.js (файлы из node_modules) ──
import fs from "node:fs";
import path from "node:path";
const req = createRequire(import.meta.url);
const libFile = (pkg, file) => fs.readFileSync(path.join(path.dirname(req.resolve(`${pkg}/package.json`)), file), "utf8");
const RUNTIME = {
  react: () => `${libFile("react", "umd/react.production.min.js")}\n;${libFile("react-dom", "umd/react-dom.production.min.js")}`,
  vue: () => libFile("vue", "dist/vue.runtime.global.prod.js"),
};
const probeNet = () => `<script>
  fetch("http://127.0.0.1:${port}/lib").catch(()=>{});
  let r = [];
  try { r.push(parent.document.title); } catch (e) { r.push("blocked"); }
  try { r.push(localStorage.length); } catch (e) { r.push("nostorage"); }
  parent.postMessage({ __demo: true, type: "probe", r }, "*");
</script>`;

test("runtime react: компонент рендерится, клик меняет state; сеть и родитель закрыты", { skip }, async () => {
  hits = 0;
  const { page, frame } = await mount({
    runtimeCode: RUNTIME.react(),
    html: `<div id="app"></div><script>
      const e = React.createElement;
      function App() { const [n, setN] = React.useState(0); return e("button", { id: "b", onClick: () => setN((x) => x + 1) }, "n=" + n); }
      ReactDOM.createRoot(document.getElementById("app")).render(e(App));
    </script>${probeNet()}`,
    steps: [{ type: "wait", ms: 100 }, { type: "click", target: "#b" }, { type: "click", target: "#b" }],
    autoplay: true,
  });
  await waitMsg(page, "done");
  assert.equal(await frame.$eval("#b", (b) => b.textContent), "n=2");
  assert.equal(await frame.evaluate(() => React.version), "18.3.1");
  await waitMsg(page, "probe");
  assert.deepEqual(await page.evaluate(() => window.msgs.find((m) => m.type === "probe").r), ["blocked", "nostorage"]);
  await page.waitForTimeout(300);
  assert.equal(hits, 0);
  await page.close();
});

test("runtime vue: h() + ref, клик реактивен; шаблоны без компилятора не нужны", { skip }, async () => {
  hits = 0;
  const { page, frame } = await mount({
    runtimeCode: RUNTIME.vue(),
    html: `<div id="app"></div><script>
      const { createApp, ref, h } = Vue;
      createApp({ setup() { const n = ref(0); return () => h("button", { id: "b", onClick: () => n.value++ }, "n=" + n.value); } }).mount("#app");
    </script>${probeNet()}`,
    steps: [{ type: "wait", ms: 100 }, { type: "click", target: "#b" }],
    autoplay: true,
  });
  await waitMsg(page, "done");
  assert.equal(await frame.$eval("#b", (b) => b.textContent), "n=1");
  await waitMsg(page, "probe");
  assert.deepEqual(await page.evaluate(() => window.msgs.find((m) => m.type === "probe").r), ["blocked", "nostorage"]);
  assert.equal(hits, 0);
  await page.close();
});
