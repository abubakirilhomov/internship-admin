import React from "react";
import { X, AlertTriangle, Crown, Shield } from "lucide-react";

const CATEGORY_META = {
  black:  { bg: "bg-gray-800",   text: "text-white",      label: "Чёрная" },
  red:    { bg: "bg-red-500",    text: "text-white",      label: "Красная" },
  yellow: { bg: "bg-yellow-400", text: "text-yellow-900", label: "Жёлтая" },
  green:  { bg: "bg-green-500",  text: "text-white",      label: "Зелёная" },
};

const Stars = ({ count }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <svg
        key={s}
        className={`w-3.5 h-3.5 ${s <= count ? "text-amber-400" : "text-slate-200"}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

const ViolationsModal = ({ intern, rules, onClose }) => {
  const violations = intern.violations || [];
  const feedbacks = [...(intern.feedbacks || [])].reverse();

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-900">
              {intern.name} {intern.lastName}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">Нарушения и отзывы менторов</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Violations */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h4 className="font-semibold text-slate-800">
                  Нарушения{" "}
                  <span className="text-slate-400 font-normal">({violations.length})</span>
                </h4>
              </div>
              {violations.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                  <Shield className="w-4 h-4" /> Нарушений нет
                </div>
              ) : (
                <ul className="space-y-2">
                  {violations.map((v, i) => {
                    const rule = rules.find((r) => r._id === v.ruleId);
                    const meta = CATEGORY_META[rule?.category] || {};
                    return (
                      <li key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {rule?.category && (
                            <span
                              className={`text-xs font-semibold rounded-full px-2 py-0.5 ${meta.bg} ${meta.text}`}
                            >
                              {meta.label}
                            </span>
                          )}
                          <span className="text-sm font-medium text-slate-800">
                            {rule?.title || v.ruleId}
                          </span>
                          {v.issuedBy === "headIntern" && (
                            <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 rounded-full px-2 py-0.5">
                              <Crown className="w-3 h-3" /> Head Intern
                            </span>
                          )}
                          {v.issuedBy === "admin" && (
                            <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                              Admin
                            </span>
                          )}
                        </div>
                        {v.notes && (
                          <p className="text-xs text-slate-600 italic mt-1">"{v.notes}"</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(v.date).toLocaleDateString("ru-RU")}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Feedbacks */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <h4 className="font-semibold text-slate-800">
                  Отзывы менторов{" "}
                  <span className="text-slate-400 font-normal">({feedbacks.length})</span>
                </h4>
              </div>
              {feedbacks.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">Отзывов ещё нет</p>
              ) : (
                <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {feedbacks.map((fb, i) => {
                    const mentor =
                      fb.mentorId && typeof fb.mentorId === "object"
                        ? `${fb.mentorId.name} ${fb.mentorId.lastName || ""}`.trim()
                        : "Ментор";
                    return (
                      <li key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-slate-800">{mentor}</span>
                          <Stars count={fb.stars} />
                        </div>
                        {fb.feedback && (
                          <p className="text-sm text-slate-700">"{fb.feedback}"</p>
                        )}
                        <p className="text-xs text-slate-400 mt-1.5 text-right">
                          {new Date(fb.date).toLocaleDateString("ru-RU")}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
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

export default ViolationsModal;
