import React, { useEffect, useState } from "react";
import { api } from "../utils/api";
import { BANK_TRACKS, fmtShortDate, overlapCellClass, overlapText } from "./live/liveFormat";

// «Наборы»: какой набор вопросов кому достался и когда, сколько раз использован,
// пересечения вопросов между последними собеседованиями (только админ).
const SOURCE = { docx: "из банка", generated: "сгенерирован", manual: "вручную" };

function ResultBadge({ percentage, passed, status }) {
  if (passed == null) {
    return <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs">{status === "finished" ? "завершено" : "идёт"}</span>;
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${passed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {Math.round(percentage)}% · {passed ? "прошёл" : "не прошёл"}
    </span>
  );
}

function Card({ title, hint, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export default function InterviewSets() {
  const liveTracks = BANK_TRACKS.filter((t) => t.value !== "backend-nodejs");
  const [track, setTrack] = useState(liveTracks[0].value);
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    Promise.all([api.interviews.live.overview({ track, recent: 8 }), api.interviews.live.history({ track, limit: 100 })])
      .then(([o, h]) => { if (!cancelled) { setOverview(o); setHistory(h.items || []); } })
      .catch((e) => { if (!cancelled) setError(e.message || "Не удалось загрузить"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [track]);

  const sets = overview?.sets || [];
  const recent = overview?.recent;
  const label = (it, i) => `№${it.setNumber ?? "—"} · ${it.candidate || `собес. ${i + 1}`}`;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Наборы вопросов</h1>
          <p className="text-sm text-slate-500">
            {overview ? `${sets.length} наборов · собеседований: ${overview.totalSessions}` : "Загрузка…"}
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {liveTracks.map((t) => (
            <button key={t.value} type="button" onClick={() => setTrack(t.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium ${t.value === track ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-slate-400 text-sm">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" /> Загрузка…
        </div>
      ) : (
        <>
          <Card title="Использование наборов" hint="Сколько раз набор брали и кому он доставался в последний раз.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">Набор</th>
                    <th className="py-2 pr-3 font-medium">Вопросов</th>
                    <th className="py-2 pr-3 font-medium">Раз</th>
                    <th className="py-2 pr-3 font-medium">Последний раз</th>
                    <th className="py-2 font-medium">Кому доставался</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sets.map((s) => (
                    <tr key={s._id} className="align-top">
                      <td className="py-2 pr-3">
                        <span className="font-medium text-slate-900">№{s.number}</span>{" "}
                        <span className="text-xs text-slate-400">{SOURCE[s.source] || s.source}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{s.size}</td>
                      <td className="py-2 pr-3">
                        <span className={s.usedCount ? "text-slate-900" : "text-slate-400"}>{s.usedCount}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{s.lastUsedAt ? fmtShortDate(s.lastUsedAt) : "—"}</td>
                      <td className="py-2 text-slate-600">
                        {s.uses.length
                          ? s.uses.map((u, i) => (
                            <div key={i} className="text-xs">{fmtShortDate(u.date)} · {u.candidate || "—"}{u.attemptNumber > 1 ? ` (попытка ${u.attemptNumber})` : ""}</div>
                          ))
                          : <span className="text-xs text-slate-400">ещё не использовался</span>}
                      </td>
                    </tr>
                  ))}
                  {!sets.length && <tr><td colSpan={5} className="py-4 text-slate-500">Наборов нет.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Пересечения последних собеседований"
            hint="Сколько вопросов совпало у двух собеседований (по фактически заданным вопросам). Зелёный — нет общих.">
            {recent?.items?.length > 1 ? (
              <div className="overflow-x-auto">
                <table className="text-xs border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th />
                      {recent.items.map((it, i) => (
                        <th key={it.sessionId} className="px-1 pb-1 font-medium text-slate-500 text-center max-w-[88px] truncate" title={label(it, i)}>{label(it, i)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.items.map((row, i) => (
                      <tr key={row.sessionId}>
                        <th className="pr-2 font-medium text-slate-500 text-right whitespace-nowrap">{label(row, i)}</th>
                        {recent.items.map((col, j) => {
                          const n = recent.overlap[i][j];
                          return (
                            <td key={col.sessionId} title={i === j ? `${n} вопросов` : overlapText(n)}
                              className={`w-14 h-9 text-center rounded-lg font-medium ${overlapCellClass(n, recent.overlap[i][i], recent.overlap[j][j], i === j)}`}>
                              {n}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Нужно хотя бы два собеседования.</p>
            )}
          </Card>

          <Card title="Кто какой набор взял" hint="Последние собеседования направления.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-3 font-medium">Дата</th>
                    <th className="py-2 pr-3 font-medium">Кандидат</th>
                    <th className="py-2 pr-3 font-medium">Интервьюер</th>
                    <th className="py-2 pr-3 font-medium">Набор</th>
                    <th className="py-2 font-medium">Итог</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.sessionId}>
                      <td className="py-2 pr-3 text-slate-600 whitespace-nowrap">{fmtShortDate(h.date)}</td>
                      <td className="py-2 pr-3 text-slate-900">{h.candidate || "—"}{h.attemptNumber > 1 && <span className="text-xs text-slate-400"> · попытка {h.attemptNumber}</span>}</td>
                      <td className="py-2 pr-3 text-slate-600">{h.interviewer || "—"}</td>
                      <td className="py-2 pr-3 text-slate-600">{h.set ? `№${h.set.number}` : "—"}</td>
                      <td className="py-2"><ResultBadge percentage={h.percentage} passed={h.passed} status={h.status} /></td>
                    </tr>
                  ))}
                  {!history.length && <tr><td colSpan={5} className="py-4 text-slate-500">Собеседований пока не было.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
