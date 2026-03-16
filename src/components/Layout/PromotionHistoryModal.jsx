import React from "react";
import { X, ArrowRight, Gift, CheckCircle } from "lucide-react";

const GRADE_LABELS = {
  junior: "Junior",
  strongJunior: "Strong Junior",
  middle: "Middle",
  strongMiddle: "Strong Middle",
  senior: "Senior",
};

const PromotionHistoryModal = ({ intern, onClose }) => {
  if (!intern) return null;

  const history = [...(intern.promotionHistory || [])].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );
  const lastWithConcession = history.length > 0 && history[0].withConcession;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-900">
              {intern.name} {intern.lastName}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              История повышений · текущий грейд:{" "}
              <span className="font-medium text-slate-700">
                {GRADE_LABELS[intern.grade] || intern.grade}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <ArrowRight className="w-10 h-10 opacity-30" />
              <p className="text-sm">Нет истории повышений</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lastWithConcession && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                  <Gift className="w-4 h-4 shrink-0 mt-0.5" />
                  Последнее повышение было с уступкой
                </div>
              )}
              {history.map((h, idx) => {
                const pct = h.percentage || 0;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
                  >
                    {/* Date */}
                    <div className="shrink-0 text-right min-w-[70px]">
                      <p className="text-xs font-medium text-slate-700">
                        {new Date(h.date).toLocaleDateString("ru-RU")}
                      </p>
                    </div>

                    {/* Grades */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700 whitespace-nowrap">
                        {GRADE_LABELS[h.fromGrade] || h.fromGrade}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                        {GRADE_LABELS[h.toGrade] || h.toGrade}
                      </span>
                    </div>

                    {/* Percentage */}
                    <div className="shrink-0 text-right">
                      <span
                        className={`text-sm font-bold ${
                          pct >= 100
                            ? "text-green-600"
                            : pct >= 70
                            ? "text-amber-500"
                            : "text-red-500"
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>

                    {/* Type */}
                    <div className="shrink-0">
                      {h.withConcession ? (
                        <span className="flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                          <Gift className="w-3 h-3" /> Уступка
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 border border-green-200 rounded-full px-2 py-0.5 whitespace-nowrap">
                          <CheckCircle className="w-3 h-3" /> Обычное
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromotionHistoryModal;
