import React, { useEffect, useRef, useState } from "react";
import { runTests } from "../../components/codeSandbox/tests";

// «Прогнать у себя»: автотесты мини-задания на коде кандидата. Выполняются в браузере, в той же
// песочнице, что и превью (ядро components/codeSandbox/tests.js — копия кандидатского); сервер код
// не запускает. Результат — подсказка: оценку ✓ ½ ✗ ставит интервьюер.
const nameOf = (t, lang) => (lang === "ru" && t.nameRu ? t.nameRu : t.name);

export default function TestPanel({ tests, editor, code, lang = "ru" }) {
  const [state, setState] = useState({ phase: "idle" }); // idle | running | done
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  // Новый вопрос/новые проверки — результат прошлого прогона не показываем.
  const key = JSON.stringify(tests.map((t) => t.name));
  useEffect(() => { setState({ phase: "idle" }); }, [key]);

  const run = async () => {
    const snapshot = code;
    setState({ phase: "running" });
    const res = await runTests({ tests: tests.map((t) => ({ name: nameOf(t, lang), code: t.code })), editor, code: snapshot, lang });
    if (mounted.current) setState({ phase: "done", res, code: snapshot });
  };

  const { phase, res } = state;
  const done = phase === "done" && !res.timedOut;
  const stale = phase === "done" && state.code !== code;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="test-panel">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Автопроверка</p>
        {done && (
          <span data-testid="test-summary"
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${res.passed === res.total ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            Пройдено {res.passed} из {res.total}
          </span>
        )}
        <button type="button" onClick={run} disabled={phase === "running" || !code?.trim()}
          className="ml-auto px-3 py-1 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {phase === "running" ? "Проверяется…" : "▶ Прогнать у себя"}
        </button>
      </div>
      {phase === "done" && res.timedOut && <p className="text-sm text-amber-700 mt-2">Проверка не завершилась — попробуйте ещё раз.</p>}
      {stale && <p className="text-xs text-slate-500 mt-2">Код кандидата изменился — прогоните ещё раз.</p>}
      {done && res.error && <p className="text-xs text-red-600 font-mono break-words mt-2">Ошибка в коде кандидата: {res.error}</p>}
      <ul className="mt-2 space-y-1 text-sm">
        {(done ? res.results : tests.map((t) => ({ name: nameOf(t, lang) }))).map((r, i) => (
          <li key={i} className="flex gap-2">
            <span className={done ? (r.ok ? "text-green-600" : "text-red-600") : "text-slate-300"} aria-hidden="true">
              {done ? (r.ok ? "✓" : "✖") : "○"}
            </span>
            <span className="min-w-0">
              <span className="text-slate-700">{r.name}</span>
              {done && !r.ok && r.message && <span data-testid="test-fail" className="block text-xs text-red-600 font-mono break-words">{r.message}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-400 mt-2">Подсказка, не оценка: решение за интервьюером.</p>
    </div>
  );
}
