import React from "react";
import { fmtClock, foldSignals, signalLine, signalSummary, signalTone } from "./liveFormat";

// Сигналы кандидата — только для сведения, вставка разрешена.
export default function SignalsList({ signals }) {
  const rows = foldSignals(signals).slice().reverse();
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Сигналы</p>
        <span className="text-xs text-slate-400">{signalSummary(signals)}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">Пока ничего.</p>
      ) : (
        <ul className="text-xs space-y-1.5 max-h-40 overflow-y-auto">
          {rows.map((s, i) => (
            <li key={`${s.at}-${i}`} className="flex gap-2">
              <span className="text-slate-400 w-10 shrink-0">{fmtClock(s.at)}</span>
              <span className="font-mono text-slate-500 w-8 shrink-0">{s.questionCode || ""}</span>
              <span className={`px-1.5 rounded ${signalTone(s)}`}>{signalLine(s)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-slate-400">Только для сведения: вставка не запрещена.</p>
    </div>
  );
}
