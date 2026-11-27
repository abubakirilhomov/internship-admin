// Рантайм живой сцены: выполняется ВНУТРИ iframe (sandbox="allow-scripts",
// без allow-same-origin), вставляется в srcdoc как `(${sceneRuntime})()`.
// Поэтому функция обязана быть самодостаточной: никаких внешних переменных
// и импортов, только DOM внутри сцены.
//
// Умеет:
//  • сценарий «▶ проиграть» (cfg.autoplay): wait, click, hover, unhover,
//    scroll, addClass, removeClass — с видимым курсором;
//  • click — по точке: событие получает тот элемент, что реально сверху
//    (elementFromPoint), а не тот, что назван в шаге. Так невидимый слой,
//    перехватывающий клик, ведёт себя как в жизни;
//  • hover — атрибут data-hover (CSS сцены пишет `.x:hover, .x[data-hover]`);
//  • 3D-вид слоёв (сообщение {__demo:"layers", on}): порядок отрисовки
//    берётся у браузера (elementsFromPoint), плоскости разносятся по
//    translateZ, сцена поворачивается — как Layers в DevTools.
export function sceneRuntime() {
  const cfgEl = document.getElementById("__demo_cfg");
  const cfg = cfgEl ? JSON.parse(cfgEl.textContent || "{}") : {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const $ = (sel) => {
    try { return sel ? document.querySelector(sel) : null; } catch { return null; }
  };
  const post = (msg) => { try { window.parent.postMessage({ __demo: true, ...msg }, "*"); } catch { /* нет родителя */ } };

  // ── курсор ──────────────────────────────────────────────────────────
  let cursor = null;
  function ensureCursor() {
    if (cursor) return cursor;
    cursor = document.createElement("div");
    cursor.setAttribute("data-demo-ui", "");
    cursor.style.cssText =
      "position:fixed;left:50%;top:110%;width:22px;height:22px;z-index:2147483647;pointer-events:none;" +
      "transition:left .6s cubic-bezier(.4,0,.2,1),top .6s cubic-bezier(.4,0,.2,1),transform .12s;" +
      "transform-origin:3px 2px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))";
    cursor.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l14 8-6 1.6L8 18z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(cursor);
    return cursor;
  }
  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  async function moveTo(el) {
    const c = ensureCursor();
    const p = centerOf(el);
    c.style.left = `${p.x}px`;
    c.style.top = `${p.y}px`;
    await sleep(650);
    return p;
  }
  function ripple(p) {
    const d = document.createElement("div");
    d.setAttribute("data-demo-ui", "");
    d.style.cssText =
      `position:fixed;left:${p.x - 14}px;top:${p.y - 14}px;width:28px;height:28px;border-radius:50%;` +
      "border:2px solid rgba(59,130,246,.9);z-index:2147483646;pointer-events:none;" +
      "transition:transform .45s ease-out,opacity .45s ease-out";
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => { d.style.transform = "scale(1.8)"; d.style.opacity = "0"; });
    setTimeout(() => d.remove(), 500);
  }
  const fire = (el, type, p) =>
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y, view: window }));

  // ── шаги сценария ──────────────────────────────────────────────────
  async function smoothScroll(target, to, ms) {
    const el = target || document.scrollingElement || document.documentElement;
    const from = el.scrollTop;
    const t0 = performance.now();
    const dur = Math.max(1, ms);
    await new Promise((resolve) => {
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        el.scrollTop = from + (to - from) * e;
        if (k < 1) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  const actions = {
    async wait(s) { await sleep(s.ms ?? 500); },
    async click(s) {
      const el = $(s.target);
      if (!el) return;
      const p = await moveTo(el);
      cursor.style.transform = "scale(.82)";
      ripple(p);
      const hit = document.elementFromPoint(p.x, p.y);
      if (hit) {
        ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach((t) => fire(hit, t, p));
        hit.click();
      }
      await sleep(140);
      cursor.style.transform = "";
      await sleep(220);
    },
    async hover(s) {
      const el = $(s.target);
      if (!el) return;
      const p = await moveTo(el);
      el.setAttribute("data-hover", "");
      fire(el, "mouseover", p);
      await sleep(100);
    },
    async unhover(s) {
      const el = $(s.target);
      if (!el) return;
      el.removeAttribute("data-hover");
      const r = el.getBoundingClientRect();
      const c = ensureCursor();
      c.style.left = `${Math.min(window.innerWidth - 24, r.right + 30)}px`;
      c.style.top = `${Math.min(window.innerHeight - 24, r.bottom + 20)}px`;
      fire(el, "mouseout", centerOf(el));
      await sleep(400);
    },
    async scroll(s) { await smoothScroll(s.target ? $(s.target) : null, s.to || 0, s.ms ?? 1200); },
    async addClass(s) { const el = $(s.target); if (el) el.classList.add(s.className); await sleep(50); },
    async removeClass(s) { const el = $(s.target); if (el) el.classList.remove(s.className); await sleep(50); },
  };

  async function play(steps) {
    post({ type: "playing" });
    await sleep(400);
    for (const s of steps || []) {
      const fn = actions[s && s.type];
      if (fn) {
        try { await fn(s); } catch { /* шаг сцены не должен ронять сценарий */ }
      }
    }
    post({ type: "done" });
  }

  // ── 3D-вид слоёв ───────────────────────────────────────────────────
  const GAP = 56;
  let stage = null;

  function isTransparent(color) {
    return !color || color === "transparent" || /rgba\([^)]*,\s*0\)$/.test(color);
  }
  function isBox(el, cs, r) {
    if (r.width < 6 || r.height < 6) return false;
    if (cs.visibility === "hidden" || cs.display === "contents") return false;
    if (el.hasAttribute("data-layer")) return true;
    const border = ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none");
    return !isTransparent(cs.backgroundColor) || cs.backgroundImage !== "none" || border || cs.boxShadow !== "none";
  }

  // Слои: элементы-«коробки» и уровни по реальному порядку отрисовки.
  function collectLayers() {
    // На время замера все элементы ловят точки (pointer-events:none иначе выпадает).
    const probe = document.createElement("style");
    probe.textContent = "*{pointer-events:auto!important}[data-demo-ui]{display:none!important}";
    document.head.appendChild(probe);
    try {
      const all = Array.from(document.body.querySelectorAll("*")).filter((el) => !el.closest("[data-demo-ui]"));
      const boxes = [];
      for (const el of all) {
        if (boxes.length >= 80) break;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) continue;
        if (isBox(el, cs, r)) boxes.push({ el, r, cs, below: new Set(), level: 0 });
      }
      const index = new Map(boxes.map((b, i) => [b.el, i]));
      const owner = (node) => {
        for (let n = node; n && n !== document.body; n = n.parentElement) {
          if (index.has(n)) return index.get(n);
        }
        return -1;
      };
      const W = window.innerWidth;
      const H = window.innerHeight;
      for (const b of boxes) {
        for (const fx of [0.15, 0.5, 0.85]) {
          for (const fy of [0.15, 0.5, 0.85]) {
            const x = Math.min(W - 1, Math.max(0, b.r.left + b.r.width * fx));
            const y = Math.min(H - 1, Math.max(0, b.r.top + b.r.height * fy));
            const order = [];
            for (const hit of document.elementsFromPoint(x, y)) {
              const o = owner(hit);
              if (o >= 0 && !order.includes(o)) order.push(o);
            }
            for (let k = 0; k + 1 < order.length; k++) boxes[order[k]].below.add(order[k + 1]);
          }
        }
      }
      // Уровень = длина самой длинной цепочки «под ним»; циклы (редко) рвём.
      const state = new Array(boxes.length).fill(0);
      const depth = (i) => {
        if (state[i] === 2) return boxes[i].level;
        if (state[i] === 1) return 0;
        state[i] = 1;
        let lvl = 0;
        boxes[i].below.forEach((j) => { lvl = Math.max(lvl, depth(j) + 1); });
        state[i] = 2;
        boxes[i].level = lvl;
        return lvl;
      };
      boxes.forEach((_, i) => depth(i));
      return boxes;
    } finally {
      probe.remove();
    }
  }

  function labelOf(el) {
    if (el.dataset.label) return el.dataset.label;
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (own) return own.length > 22 ? `${own.slice(0, 21)}…` : own;
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    return `${el.tagName.toLowerCase()}${cls}`;
  }

  function showLayers() {
    if (stage) return;
    const boxes = collectLayers();
    stage = document.createElement("div");
    stage.setAttribute("data-demo-ui", "");
    stage.style.cssText =
      "position:fixed;inset:0;z-index:2147483645;background:#0f172a;perspective:1400px;overflow:hidden;" +
      "opacity:0;transition:opacity .25s";
    const world = document.createElement("div");
    world.style.cssText =
      "position:absolute;inset:0;transform-style:preserve-3d;transform-origin:50% 50%;" +
      "transition:transform .9s cubic-bezier(.3,.7,.2,1)";
    stage.appendChild(world);
    const maxLevel = boxes.reduce((m, b) => Math.max(m, b.level), 0);
    // Поворот вокруг центра содержимого, а не всего окна.
    const bx = boxes.reduce((a, b) => ({
      l: Math.min(a.l, b.r.left), t: Math.min(a.t, b.r.top), r: Math.max(a.r, b.r.right), b: Math.max(a.b, b.r.bottom),
    }), { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
    const cx = boxes.length ? (bx.l + bx.r) / 2 : window.innerWidth / 2;
    const cy = boxes.length ? (bx.t + bx.b) / 2 : window.innerHeight / 2;
    world.style.transformOrigin = `${cx}px ${cy}px`;
    const fitK = boxes.length ? Math.min(1, (window.innerWidth * 0.8) / Math.max(1, bx.r - bx.l), (window.innerHeight * 0.75) / Math.max(1, bx.b - bx.t)) : 1;
    const planes = boxes
      .slice()
      .sort((a, b) => a.level - b.level)
      .map((b) => {
        const p = document.createElement("div");
        const hue = (215 + b.level * 47) % 360;
        const tint = `hsla(${hue},85%,58%,.30)`;
        const bg = isTransparent(b.cs.backgroundColor) ? "rgba(148,163,184,.10)" : b.cs.backgroundColor;
        p.style.cssText =
          `position:absolute;left:${b.r.left}px;top:${b.r.top}px;width:${b.r.width}px;height:${b.r.height}px;` +
          `background-color:${bg};background-image:linear-gradient(${tint},${tint});` +
          `border:1.5px solid hsl(${hue},85%,62%);border-radius:${b.cs.borderRadius};` +
          "transition:transform .9s cubic-bezier(.3,.7,.2,1);" +
          "font:600 11px/1.2 system-ui,sans-serif;color:#fff;overflow:hidden;opacity:.94";
        const tag = document.createElement("span");
        tag.textContent = labelOf(b.el);
        tag.style.cssText = `position:absolute;left:4px;top:3px;background:hsl(${hue},70%,40%);padding:1px 5px;border-radius:4px;white-space:nowrap`;
        p.appendChild(tag);
        world.appendChild(p);
        return { p, level: b.level };
      });
    if (cursor) cursor.style.visibility = "hidden";
    document.documentElement.appendChild(stage);
    requestAnimationFrame(() => {
      stage.style.opacity = "1";
      requestAnimationFrame(() => {
        world.style.transform =
          `translate(${window.innerWidth / 2 - cx}px,${window.innerHeight / 2 - cy}px) ` +
          `scale(${(0.82 * fitK).toFixed(3)}) rotateX(32deg) rotateY(-36deg) translateZ(${-maxLevel * GAP * 0.5}px)`;
        planes.forEach(({ p, level }) => { p.style.transform = `translateZ(${level * GAP}px)`; });
      });
    });
    post({ type: "layers", on: true, levels: maxLevel + 1 });
  }

  function hideLayers() {
    if (!stage) return;
    const s = stage;
    stage = null;
    const world = s.firstChild;
    world.style.transform = "";
    Array.from(world.children).forEach((p) => { p.style.transform = ""; });
    setTimeout(() => { s.style.opacity = "0"; }, 650);
    setTimeout(() => { s.remove(); if (cursor) cursor.style.visibility = ""; }, 950);
    post({ type: "layers", on: false });
  }

  window.addEventListener("message", (e) => {
    if (e.source !== window.parent || !e.data || e.data.__demo !== true) return;
    if (e.data.type === "layers") (e.data.on ? showLayers : hideLayers)();
  });

  const start = () => { post({ type: "ready" }); if (cfg.autoplay) play(cfg.steps); };
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
}
