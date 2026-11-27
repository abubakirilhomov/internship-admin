import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SANDBOX, WIDTHS, buildRunDoc } from "./runner";

// Превью и консоль ответа кандидата у интервьюера. Тот же buildRunDoc, что у
// кандидата (ядро песочницы — копия, сверяется sync.test.js), поэтому результат
// одинаковый. Код кандидата выполняется только в iframe без allow-same-origin:
// до access-токена админки (localStorage) он не дотянется. Сообщения — только
// от своего iframe и текущего прогона, выводятся как текст.
const DEBOUNCE_MS = 700;
const MAX_LOGS = 500;
let runSeq = 0;
const newRunId = () => `${Date.now().toString(36)}-${(runSeq += 1)}`;

const LEVEL_CLS = {
  log: "text-slate-700",
  info: "text-blue-600",
  warn: "text-amber-600",
  error: "text-red-600",
};

export default function AnswerRunner({ editor, code, previewHeight = 200, consoleClass = "max-h-40", lang = "ru", initialWidth = 0 }) {
  const isJs = editor === "js";
  const [width, setWidth] = useState(initialWidth);
  const [showPage, setShowPage] = useState(!isJs);
  const [run, setRun] = useState(() => ({ id: newRunId(), code }));
  const [logs, setLogs] = useState([]);
  const [containerW, setContainerW] = useState(0);
  const frameRef = useRef(null);
  const wrapRef = useRef(null);
  const runIdRef = useRef(run.id);
  runIdRef.current = run.id;

  useEffect(() => {
    if (code === run.code) return undefined;
    const id = setTimeout(() => setRun({ id: newRunId(), code }), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [code, run.code]);

  const rerun = useCallback(() => setRun({ id: newRunId(), code }), [code]);
  const pickWidth = (w) => { setWidth(w); setRun({ id: newRunId(), code }); };
  const srcDoc = useMemo(() => buildRunDoc({ editor, code: run.code, runId: run.id, lang }), [editor, run, lang]);

  useLayoutEffect(() => { setLogs([]); }, [run.id]);

  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      if (!d || typeof d !== "object" || d.__sbx !== runIdRef.current) return;
      if (d.type === "clear") { setLogs([]); return; }
      if (d.type !== "log" && d.type !== "error") return;
      const entry = {
        level: d.type === "error" ? "error" : (LEVEL_CLS[d.level] ? d.level : "log"),
        text: String(d.text ?? "").slice(0, 5000),
        line: d.type === "error" && Number(d.line) > 0 ? Number(d.line) : 0,
      };
      setLogs((l) => (l.length >= MAX_LOGS ? l : [...l, entry]));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPage]);

  const frameW = width || Math.max(1, Math.floor(containerW) - 2);
  const scale = width && containerW ? Math.min(1, (containerW - 2) / width) : 1;
  const frameH = Math.round(previewHeight / scale);

  return (
    <div className="space-y-2" data-testid="answer-runner">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] font-semibold uppercase text-slate-500 mr-1">Результат</span>
        {isJs && (
          <button type="button" onClick={() => setShowPage((s) => !s)} aria-pressed={showPage}
            className={`px-2 py-0.5 rounded text-xs ${showPage ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100"}`}>
            Страница
          </button>
        )}
        {showPage && WIDTHS.map((w) => (
          <button key={w} type="button" onClick={() => pickWidth(w)} aria-pressed={w === width}
            className={`px-2 py-0.5 rounded text-xs ${w === width ? "bg-blue-100 text-blue-700 font-semibold" : "text-slate-500 hover:bg-slate-100"}`}>
            {w || "Авто"}
          </button>
        ))}
        <button type="button" onClick={rerun} title="Запустить заново"
          className="ml-auto px-2 py-0.5 rounded text-xs text-slate-500 hover:bg-slate-100">↻</button>
      </div>

      <div ref={wrapRef} className={showPage ? "w-full" : "hidden"}>
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white mx-auto"
          style={{ width: width ? frameW * scale + 2 : "100%", height: previewHeight + 2 }}>
          <iframe
            key={run.id}
            ref={frameRef}
            title="Результат кода кандидата"
            sandbox={SANDBOX}
            referrerPolicy="no-referrer"
            srcDoc={srcDoc}
            style={{ width: frameW, height: frameH, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", display: "block", background: "#fff" }}
          />
        </div>
        {width > 0 && scale < 1 && (
          <p className="text-[11px] text-slate-400 mt-0.5 text-center">{width}px · {Math.round(scale * 100)}%</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs leading-relaxed">
        <div className="flex items-center justify-between px-2.5 py-1 border-b border-slate-200">
          <span className="font-sans text-[11px] font-semibold uppercase text-slate-500">Консоль{logs.length ? ` · ${logs.length}` : ""}</span>
        </div>
        <div className={`${consoleClass} min-h-10 overflow-auto px-2.5 py-1.5 space-y-0.5`} role="log">
          {logs.length === 0 ? (
            <p className="text-slate-400 font-sans">Пусто</p>
          ) : logs.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-words ${LEVEL_CLS[l.level]}`}>
              {l.level === "error" ? "✖ " : l.level === "warn" ? "⚠ " : ""}{l.text}
              {l.line > 0 && <span className="text-slate-400"> · строка {l.line}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
