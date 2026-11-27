import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SandpackProvider, useSandpackClient } from "@codesandbox/sandpack-react";
import { WIDTHS } from "./runner";
import { BUNDLER_URL, SANDPACK_IFRAME_SANDBOX, consoleEntries, sandpackSetup } from "./sandpack";

// Превью и консоль ответа кандидата на React / Vue / Vue + Tailwind у интервьюера.
// Та же настройка Sandpack, что у кандидата (ядро — копия, сверяется sync.test.js),
// поэтому результат одинаковый. Код выполняется в iframe на домене бандлера CodeSandbox —
// чужой origin: токен админки ему недоступен (см. sandpack.js). Свой iframe вместо
// SandpackPreview: минимальный sandbox (без popups / top-navigation / modals).
const DEBOUNCE_MS = 900;
const LOAD_TIMEOUT_MS = 25000;
const MAX_LOGS = 500;
const LEVEL_CLS = { log: "text-slate-700", info: "text-blue-600", warn: "text-amber-600", error: "text-red-600" };

function Pane({ previewHeight, consoleClass, rerunKey, onRerun, onReady }) {
  const { sandpack, listen, iframe } = useSandpackClient();
  const [width, setWidth] = useState(0);
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [containerW, setContainerW] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    const off = listen((msg) => {
      if (msg.type === "done") { setLoaded(true); setTimedOut(false); onReady(); return; }
      if (msg.type !== "console") return;
      const add = consoleEntries(msg);
      if (!add.length) return;
      setLogs((l) => {
        let next = l;
        for (const e of add) {
          if (e.clear) next = [];
          else if (next.length < MAX_LOGS) next = [...next, e];
        }
        return next;
      });
    });
    return off;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setLogs([]); }, [rerunKey]);

  useEffect(() => {
    if (loaded) return undefined;
    const id = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [loaded, rerunKey]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const frameW = width || Math.max(1, Math.floor(containerW) - 2);
  const scale = width && containerW ? Math.min(1, (containerW - 2) / width) : 1;
  const frameH = Math.round(previewHeight / scale);
  const err = sandpack.error;
  const errText = err ? [err.title, err.message].filter(Boolean).join(": ") : "";
  const errLine = err && Number(err.line) > 0 ? Number(err.line) : 0;

  return (
    <div className="space-y-2" data-testid="answer-runner" data-engine="sandpack">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] font-semibold uppercase text-slate-500 mr-1">Результат</span>
        {WIDTHS.map((w) => (
          <button key={w} type="button" onClick={() => setWidth(w)} aria-pressed={w === width}
            className={`px-2 py-0.5 rounded text-xs ${w === width ? "bg-blue-100 text-blue-700 font-semibold" : "text-slate-500 hover:bg-slate-100"}`}>
            {w || "Авто"}
          </button>
        ))}
        <button type="button" onClick={onRerun} title="Запустить заново"
          className="ml-auto px-2 py-0.5 rounded text-xs text-slate-500 hover:bg-slate-100">↻</button>
      </div>

      <div ref={wrapRef} className="w-full">
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white mx-auto"
          style={{ width: width ? frameW * scale + 2 : "100%", height: previewHeight + 2 }}>
          <iframe
            ref={iframe}
            title="Результат кода кандидата"
            sandbox={SANDPACK_IFRAME_SANDBOX}
            referrerPolicy="no-referrer"
            allow=""
            style={{ width: frameW, height: frameH, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", display: "block", background: "#fff" }}
          />
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/90 text-xs text-slate-500 px-3 text-center" data-testid="sp-loading">
              {timedOut ? "Результат не загрузился — проверьте интернет и нажмите ↻" : "Загрузка результата…"}
            </div>
          )}
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
          {errText && (
            <div className="whitespace-pre-wrap break-words text-red-600" data-testid="sp-error">
              ✖ {errText.slice(0, 2000)}{errLine > 0 && <span className="text-slate-400"> · строка {errLine}</span>}
            </div>
          )}
          {logs.length === 0 && !errText ? (
            <p className="text-slate-400 font-sans">Пусто</p>
          ) : logs.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-words ${LEVEL_CLS[l.level]}`}>
              {l.level === "error" ? "✖ " : l.level === "warn" ? "⚠ " : ""}{l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SandpackAnswerRunner({ editor, code, previewHeight = 240, consoleClass = "max-h-40" }) {
  const [shown, setShown] = useState(code);
  const [rerunKey, setRerunKey] = useState(0);
  useEffect(() => {
    if (code === shown) return undefined;
    const id = setTimeout(() => setShown(code), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [code, shown]);

  // Правка во время первой загрузки бандлера теряется (проверено у кандидата): до первого
  // «done» отдаём код на момент монтирования, потом — актуальный.
  const first = useRef(code);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const setup = useMemo(() => sandpackSetup(editor, ready ? shown : first.current), [editor, shown, ready]);
  const onRerun = useCallback(() => { first.current = code; setReady(false); setRerunKey((k) => k + 1); }, [code]);

  return (
    <SandpackProvider
      key={`${editor}-${rerunKey}`}
      template={setup.template}
      files={setup.files}
      customSetup={{ dependencies: setup.dependencies }}
      options={{
        bundlerURL: BUNDLER_URL,
        externalResources: setup.externalResources,
        recompileMode: "immediate",
        autorun: true,
        initMode: "immediate",
      }}
    >
      <Pane previewHeight={previewHeight} consoleClass={consoleClass} rerunKey={rerunKey} onRerun={onRerun} onReady={onReady} />
    </SandpackProvider>
  );
}

// Прогрев: пока открыт живой экран, бандлер и пакеты кэшируются в скрытом iframe
// (холодная загрузка 3–5,6 с, тёплая 1–2 с). По первому «done» родитель снимает прогрев.
function WarmupProbe({ onDone }) {
  const { listen, iframe } = useSandpackClient();
  useEffect(() => listen((msg) => { if (msg.type === "done") onDone(); }), []); // eslint-disable-line react-hooks/exhaustive-deps
  return <iframe ref={iframe} title="" tabIndex={-1} sandbox={SANDPACK_IFRAME_SANDBOX} referrerPolicy="no-referrer" allow="" style={{ width: 320, height: 200, border: 0 }} />;
}

export function SandpackWarmup({ editor, onDone }) {
  const setup = useMemo(() => sandpackSetup(editor, ""), [editor]);
  return (
    <div aria-hidden="true" style={{ position: "fixed", left: -9999, top: 0, width: 320, height: 200, overflow: "hidden", pointerEvents: "none" }} data-testid="sp-warmup">
      <SandpackProvider
        template={setup.template}
        files={setup.files}
        customSetup={{ dependencies: setup.dependencies }}
        options={{ bundlerURL: BUNDLER_URL, externalResources: setup.externalResources, recompileMode: "immediate", autorun: true, initMode: "immediate" }}
      >
        <WarmupProbe onDone={onDone} />
      </SandpackProvider>
    </div>
  );
}
