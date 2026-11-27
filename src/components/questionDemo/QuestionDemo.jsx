import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCcw, Layers, Wrench, Smartphone, Monitor } from "lucide-react";
import { SANDBOX, SLIDER, buildSrcdoc, clampWidth, fitScale, localizedCaption, resolveVariant } from "./srcdoc";

// Живая сцена под вопросом. Один компонент для админки и (позже) приложения
// кандидата. `fix` передаётся ТОЛЬКО интервьюеру — кандидатский API его не
// отдаёт (int-server serializers/candidateView), а без fix кнопки нет.
//
// demo: { html, css, steps, caption, captionRu, height, width, slider, layers3d }
export default function QuestionDemo({ demo, fix = null, lang = "uz" }) {
  const wrapRef = useRef(null);
  const frameRef = useRef(null);
  const [containerW, setContainerW] = useState(0);
  const [showFix, setShowFix] = useState(false);
  const [width, setWidth] = useState(() => clampWidth(demo?.width || (demo?.slider ? SLIDER.max : 375)));
  const [run, setRun] = useState({ key: 0, autoplay: false });
  const [status, setStatus] = useState("idle"); // idle | playing | done
  const [layers, setLayers] = useState(false);

  const variant = useMemo(() => resolveVariant(demo, fix, showFix), [demo, fix, showFix]);
  const steps = variant?.steps || [];
  const srcDoc = useMemo(
    () => (variant ? buildSrcdoc({ html: variant.html, css: variant.css, steps, autoplay: run.autoplay }) : ""),
    // run.key: «▶» пересобирает сцену с нуля
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [variant, run]
  );

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMsg = (e) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow || !e.data?.__demo) return;
      if (e.data.type === "playing") setStatus("playing");
      if (e.data.type === "done") setStatus("done");
      if (e.data.type === "layers") setLayers(!!e.data.on);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Новый вариант/перезапуск — 3D сбрасывается вместе со сценой.
  useEffect(() => { setLayers(false); setStatus("idle"); }, [srcDoc]);

  const play = useCallback(() => setRun((r) => ({ key: r.key + 1, autoplay: true })), []);
  const toggleLayers = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ __demo: true, type: "layers", on: !layers }, "*");
  }, [layers]);

  if (!demo?.html) return null;

  const sceneW = demo.slider ? width : Math.min(SLIDER.max, Math.max(320, Number(demo.width) || 375));
  const height = demo.height || 320;
  const scale = fitScale(sceneW, containerW || sceneW);
  const caption = localizedCaption(variant, lang);
  const btn = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {steps.length > 0 && (
          <button type="button" onClick={play} disabled={status === "playing"}
            className={`${btn} bg-blue-600 border-blue-600 text-white hover:bg-blue-700 disabled:opacity-60`}>
            {status === "done" ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {status === "playing" ? "Идёт…" : status === "done" ? "Ещё раз" : "Проиграть"}
          </button>
        )}
        {demo.layers3d && (
          <button type="button" onClick={toggleLayers} disabled={status === "playing"}
            className={`${btn} ${layers ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"}`}>
            <Layers className="w-3.5 h-3.5" /> {layers ? "Обычный вид" : "3D-слои"}
          </button>
        )}
        {fix && (
          <button type="button" onClick={() => setShowFix((v) => !v)}
            className={`${btn} ml-auto ${showFix ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>
            <Wrench className="w-3.5 h-3.5" /> {showFix ? "Показать проблему" : "Показать исправление"}
          </button>
        )}
      </div>

      {demo.slider && (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Smartphone className="w-4 h-4 shrink-0" />
          <input type="range" min={SLIDER.min} max={SLIDER.max} step={1} value={width}
            onChange={(e) => setWidth(clampWidth(e.target.value))} className="flex-1 accent-blue-600" aria-label="Ширина сцены" />
          <Monitor className="w-4 h-4 shrink-0" />
          <span className="w-14 text-right font-mono tabular-nums">{width}px</span>
          {SLIDER.presets.map((p) => (
            <button key={p} type="button" onClick={() => setWidth(p)}
              className={`px-1.5 py-0.5 rounded border ${p === width ? "border-blue-500 text-blue-700 bg-blue-50" : "border-slate-200 bg-white"}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      <div ref={wrapRef} className="w-full flex justify-center">
        <div
          className={`relative overflow-hidden rounded-lg border-2 bg-white ${showFix ? "border-emerald-400" : "border-slate-300"}`}
          style={{ width: sceneW * scale + 4, height: height * scale + 4 }}
        >
          <iframe
            key={run.key}
            ref={frameRef}
            title="Живая сцена к вопросу"
            sandbox={SANDBOX}
            referrerPolicy="no-referrer"
            srcDoc={srcDoc}
            style={{ width: sceneW, height, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", display: "block" }}
          />
          {showFix && (
            <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold">
              исправлено
            </span>
          )}
        </div>
      </div>

      {caption && <p className="text-xs text-slate-600 text-center">{caption}</p>}
    </div>
  );
}
