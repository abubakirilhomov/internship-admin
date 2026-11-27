import React, { Suspense, lazy, useEffect, useState } from "react";
import { RESULT_KEYS, RESULT_META, answerStatus, withDrafts } from "./liveFormat";
import { canRun, usesSandpack } from "../../components/codeSandbox/runnable";
import { canTest } from "../../components/codeSandbox/testable";
import TestPanel from "./TestPanel";

// Песочница — отдельным чанком: нужна только на amaliy-вопросах web/js.
const AnswerRunner = lazy(() => import("../../components/codeSandbox/AnswerRunner"));
// React / Vue / Tailwind — бандлер CodeSandbox (Sandpack), отдельный чанк.
const SandpackAnswerRunner = lazy(() => import("../../components/codeSandbox/SandpackAnswerRunner"));
const Runner = (props) => (usesSandpack(props.editor) ? <SandpackAnswerRunner {...props} /> : <AnswerRunner {...props} />);

// Во весь экран: код слева, результат и консоль справа — крупнее, чем в колонке.
function RunnerOverlay({ question, code, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-7xl max-h-full overflow-auto p-5" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Ответ кандидата во весь экран">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700">Ответ кандидата · <span className="font-mono">{question.code}</span></p>
          <button type="button" onClick={onClose} className="px-3 py-1 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Закрыть ✕</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <pre className="text-sm font-mono bg-slate-50 border border-slate-100 rounded-lg p-3 text-slate-700 max-h-[70vh] overflow-auto whitespace-pre">{code}</pre>
          <Suspense fallback={<div className="h-96 rounded-lg bg-slate-100 animate-pulse" />}>
            <Runner editor={question.editor} code={code} previewHeight={420} consoleClass="max-h-56" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

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
  const runnable = canRun(question.editor) && question.answerKind !== "choice";
  const [full, setFull] = useState(false);

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
          {!runnable && question.editor && question.answerKind !== "choice" && answer?.text && (
            <p className="text-xs text-slate-400 mt-1">Код не запускается в браузере ({question.editor}) — только просмотр.</p>
          )}
          {runnable && answer?.text && (
            <div className="mt-3">
              <Suspense fallback={<div className="h-48 rounded-lg bg-slate-100 animate-pulse" />}>
                <Runner editor={question.editor} code={answer.text} />
              </Suspense>
              <button type="button" onClick={() => setFull(true)}
                className="mt-1 text-xs text-blue-600 hover:underline">Во весь экран</button>
              {full && <RunnerOverlay question={question} code={answer.text} onClose={() => setFull(false)} />}
            </div>
          )}
          {canTest(question.editor) && question.answerKind !== "choice" && question.tests?.length > 0 && answer?.text && (
            <TestPanel tests={question.tests} editor={question.editor} code={answer.text} lang={lang} />
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
