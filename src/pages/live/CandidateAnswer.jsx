import React, { useEffect, useState } from "react";
import { RESULT_KEYS, RESULT_META, answerStatus, withDrafts } from "./liveFormat";

// Ответ кандидата (приходит опросом), оценка ✓ ½ ✗ и заметка. Сохраняется сразу.
export default function CandidateAnswer({ question, drafts, onRate, offline, lang }) {
  const q = withDrafts(question, drafts);
  const [now, setNow] = useState(Date.now());
  const [note, setNote] = useState(q.note || "");
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // Заметка: при смене вопроса — его заметка; при обновлении с сервера не затираем набираемое.
  useEffect(() => { setNote(question.note || ""); }, [question.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = question.answer;
  const st = answerStatus(answer, now);
  const typing = st.kind === "typing";
  const pendingResult = drafts[question.code]?.result !== undefined;
  const pendingNote = drafts[question.code]?.note !== undefined;
  const opt = question.answerKind === "choice" && answer?.text
    ? (question.options || []).find((o) => o.key === answer.text) : null;
  const optText = opt ? ((lang === "ru" && opt.textRu) || opt.text) : "";

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-xs font-semibold text-slate-500 uppercase">Ответ кандидата</p>
        {typing && (
          <span className="text-xs text-blue-600 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> {st.text}
          </span>
        )}
      </div>
      {question.state === "hidden" ? (
        <p className="text-sm text-slate-400">Вопрос ещё не открыт кандидату.</p>
      ) : question.discussOnly ? (
        <p className="text-sm text-slate-400">Вопрос «только обсудить» — письменного ответа нет. Оцените устный ответ.</p>
      ) : (
        <>
          {question.answerKind === "choice" ? (
            <p className="text-sm bg-slate-50 border border-slate-100 rounded-lg p-3 text-slate-700 min-h-12">
              {answer?.text ? <><span className="font-mono mr-1">{answer.text}.</span>{optText}</> : <span className="text-slate-400">Не выбрано</span>}
            </p>
          ) : (
            <pre className="text-sm font-mono bg-slate-50 border border-slate-100 rounded-lg p-3 text-slate-700 min-h-24 max-h-64 overflow-auto whitespace-pre-wrap break-words">
              {answer?.text || ""}
            </pre>
          )}
          {!typing ? <p className="text-xs text-slate-400 mt-1">{st.text}</p>
            : !answer?.submittedAt && <p className="text-xs text-slate-400 mt-1">Ещё не отправлен</p>}
        </>
      )}
      <div className="mt-3 flex items-center gap-2">
        {RESULT_KEYS.map((k) => {
          const on = q.result === k;
          return (
            <button key={k} type="button" onClick={() => onRate(question.code, { result: on ? null : k })}
              aria-pressed={on} aria-label={k}
              className={`w-9 h-9 rounded-lg text-sm font-bold ${on ? RESULT_META[k].cls : RESULT_META[k].idle}`}>
              {RESULT_META[k].label}
            </button>
          );
        })}
        <span className={`text-xs ${offline && (pendingResult || pendingNote) ? "text-orange-600" : "text-slate-400"}`}>
          {offline && (pendingResult || pendingNote) ? "не отправлено" : "оценка сохраняется сразу"}
        </span>
      </div>
      <textarea rows={2} value={note} placeholder="Заметка (кандидат не видит)"
        onChange={(e) => { setNote(e.target.value); onRate(question.code, { note: e.target.value }, { immediate: false }); }}
        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400" />
    </div>
  );
}
