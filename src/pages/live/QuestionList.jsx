import React from "react";
import { Lock, Radio, EyeOff } from "lucide-react";
import { LEVELS, RESULT_META, questionShort, withDrafts } from "./liveFormat";

const STATE_ICON = {
  hidden: <EyeOff className="w-3.5 h-3.5 text-slate-300" />,
  open: <Radio className="w-3.5 h-3.5 text-blue-600" />,
  closed: <Lock className="w-3.5 h-3.5 text-slate-400" />,
};

// Слева: все вопросы набора, состояние и оценка.
export default function QuestionList({ questions, drafts, selected, lang, onSelect }) {
  const shown = questions.filter((q) => q.state !== "hidden").length;
  return (
    <section className="bg-white rounded-2xl shadow p-3 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-2 mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Вопросы набора</p>
        <span className="text-xs text-slate-400">открыто {shown} из {questions.length}</span>
      </div>
      <ul className="space-y-0.5 overflow-y-auto">
        {questions.map((raw) => {
          const q = withDrafts(raw, drafts);
          const lv = LEVELS[q.level];
          const meta = q.result ? RESULT_META[q.result] : null;
          const active = q.code === selected;
          return (
            <li key={q.code}>
              <button type="button" onClick={() => onSelect(q.code)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left ${active ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-slate-50"}`}>
                <span className="w-5 text-xs text-slate-400 text-right">{q.order}</span>
                {STATE_ICON[q.state]}
                <span className="text-xs font-mono text-slate-500 w-8">{q.code}</span>
                <span className="text-sm text-slate-700 flex-1 truncate">
                  {questionShort(q, lang)}
                  {q.isPractical && <span className="ml-1 text-xs text-slate-400">amaliy</span>}
                  {q.discussOnly && <span className="ml-1 text-xs text-slate-400">обсуждение</span>}
                </span>
                {lv && <span className={`text-xs px-1.5 py-0.5 rounded ${lv.cls}`}>{lv.label}</span>}
                {meta ? (
                  <span className={`w-5 h-5 rounded text-xs font-bold grid place-items-center ${meta.cls}`}>{meta.label}</span>
                ) : <span className="w-5 h-5" />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
