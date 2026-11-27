import React from "react";
import { pluralOpen } from "./liveFormat";

// Подтверждение «Завершить»: сколько открытых без оценки, итог, проходит ли кандидат.
export default function FinishModal({ view, saving, onCancel, onConfirm }) {
  const score = view.score;
  const total = view.questions.length;
  const shown = view.questions.filter((q) => q.state !== "hidden").length;
  const open = score?.unratedShown || 0;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={saving ? undefined : onCancel}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Завершить собеседование?</h2>
        </div>
        <div className="p-5 space-y-3 text-sm text-slate-700">
          <p>
            Открыто {shown} из {total}.
            {open > 0 && <> <span className="text-red-600">{open} {pluralOpen(open)} без оценки</span> — считаются как 0.</>}
          </p>
          <p className={`font-semibold ${score?.passed ? "text-green-600" : "text-red-600"}`}>
            {score?.percentage}% · {score?.earned} / {score?.total} · {score?.passed ? `проходит (порог ${score?.threshold}%)` : `не проходит (порог ${score?.threshold}%)`}
          </p>
          <p className="text-xs text-slate-400">Доступ кандидата отключится сразу. Итог запишется в собеседование, письмо отправит interns-agent.</p>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onCancel} disabled={saving} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">Вернуться</button>
          <button onClick={onConfirm} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60">
            {saving ? "Сохранение…" : "Завершить и сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
