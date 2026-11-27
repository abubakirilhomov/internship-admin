import React from "react";
import { ArrowRight, Eye, Lock, MessageSquare, Send } from "lucide-react";
import QuestionDemo from "../../components/questionDemo/QuestionDemo";
import {
  LEVELS, TOPIC_LABELS, expectedText, fmtClock, nextHidden, questionText, splitBlocks,
} from "./liveFormat";

function Prompt({ text }) {
  return (
    <div className="space-y-3">
      {splitBlocks(text).map((b, i) => b.type === "code" ? (
        <pre key={i} className="text-sm font-mono bg-slate-50 border border-slate-100 rounded-lg p-3 text-slate-700 overflow-x-auto">{b.value}</pre>
      ) : (
        <p key={i} className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{b.value}</p>
      ))}
    </div>
  );
}

// Центр: текущий вопрос, управление, живая сцена и ответ банка (видит только интервьюер).
export default function QuestionPanel({ question, questions, lang, onLang, onAction, disabled, offline }) {
  const q = question;
  const lv = LEVELS[q.level];
  const next = nextHidden(questions, q.code);
  const btn = "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed";
  const primary = `${btn} text-white bg-blue-600 hover:bg-blue-700`;
  const quiet = `${btn} text-slate-700 bg-slate-100 hover:bg-slate-200`;
  const stateText = q.state === "open" ? `открыт ${fmtClock(q.openedAt)}` : q.state === "closed" ? `закрыт ${fmtClock(q.closedAt)}` : "скрыт от кандидата";
  const off = disabled || offline;
  const expected = expectedText(q, lang);

  return (
    <>
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-mono text-slate-500">{q.code}</span>
          {lv && <span className={`text-xs px-1.5 py-0.5 rounded ${lv.cls}`}>{lv.label}</span>}
          {q.isPractical && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">amaliy</span>}
          {q.discussOnly && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">только обсудить</span>}
          <span className="text-xs text-slate-400">{TOPIC_LABELS[q.topic] || q.topic} · {stateText}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {["uz", "ru"].map((l) => (
              <button key={l} type="button" onClick={() => onLang(l)}
                className={`px-2 py-0.5 rounded text-xs font-medium ${lang === l ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <Prompt text={questionText(q, lang)} />

        {q.answerKind === "choice" && q.options?.length > 0 && (
          <ul className="mt-3 space-y-1">
            {q.options.map((o) => (
              <li key={o.key} className={`flex gap-2 text-sm px-3 py-1.5 rounded-lg border ${o.correct ? "border-green-300 bg-green-50 text-green-900" : "border-slate-100 text-slate-700"}`}>
                <span className="font-mono">{o.key}.</span>
                <span className="flex-1">{(lang === "ru" && o.textRu) || o.text}</span>
                {o.correct && <span className="text-xs font-semibold text-green-700">верный</span>}
              </li>
            ))}
          </ul>
        )}

        {q.demo?.html && (
          <div className="mt-4">
            <QuestionDemo key={`${q.code}-${lang}`} demo={q.demo} fix={q.demoFix || null} lang={lang} />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {q.state === "open" ? (
            <>
              <button type="button" disabled={off} onClick={() => onAction(q.code, "close")} className={quiet}>
                <Lock className="w-4 h-4" /> Закрыть вопрос
              </button>
              {next && (
                <button type="button" disabled={off} onClick={() => onAction(next.code, "open")} className={primary}>
                  Открыть следующий: {next.code} <ArrowRight className="w-4 h-4" />
                </button>
              )}
              <span className="text-xs text-slate-400 ml-2">Закрытый вопрос остаётся у кандидата только для чтения</span>
            </>
          ) : (
            <>
              <button type="button" disabled={off} onClick={() => onAction(q.code, "open")} className={primary}>
                <Send className="w-4 h-4" /> Открыть кандидату
              </button>
              <button type="button" disabled={off} onClick={() => onAction(q.code, "discuss")} className={quiet}>
                <MessageSquare className="w-4 h-4" /> Только обсудить
              </button>
              <span className="text-xs text-slate-400 ml-2">«Только обсудить»: кандидат видит текст, поля ответа нет</span>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
        <p className="text-xs font-semibold text-amber-800 uppercase mb-2 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Ответ из банка — видите только вы
        </p>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{expected || "Ответ в банке не заполнен."}</p>
      </div>
    </>
  );
}
