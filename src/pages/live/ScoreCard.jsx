import React from "react";

// Один блок: балл строкой и шкала с меткой порога. Без плиток статистики.
export default function ScoreCard({ score }) {
  const pct = Math.max(0, Math.min(100, score?.percentage || 0));
  const w = score?.levelWeights || {};
  const bar = score?.passed ? "bg-green-500" : "bg-amber-400";
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase">Текущий балл</p>
        <p className="text-xs text-slate-400">оценено {score?.rated ?? 0} · без оценки {score?.unrated ?? 0}</p>
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {score?.percentage ?? 0}%{" "}
        <span className="text-sm font-normal text-slate-500">· {score?.earned ?? 0} / {score?.total ?? 0} · нужно ≥{score?.threshold ?? 80}%</span>
      </p>
      <div className="relative mt-2 h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
        <div className="absolute -top-1 h-4 w-0.5 bg-slate-700" style={{ left: `${score?.threshold ?? 80}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Вес: oson {w.oson ?? 1} · o'rta {w.orta ?? 2} · qiyin {w.qiyin ?? 3}. % от открытых кандидату: открытый без оценки = 0, неоткрытые не входят.
      </p>
    </div>
  );
}
