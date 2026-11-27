import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import { ArrowLeft, Flag, KeyRound, WifiOff, Clock } from "lucide-react";
import { api } from "../utils/api";
import useLiveSession from "./live/useLiveSession";
import QuestionList from "./live/QuestionList";
import QuestionPanel from "./live/QuestionPanel";
import ScoreCard from "./live/ScoreCard";
import CandidateAnswer from "./live/CandidateAnswer";
import SignalsList from "./live/SignalsList";
import FinishModal from "./live/FinishModal";
import CandidateAccessModal from "../components/interviews/CandidateAccessModal";
import InterviewResultModal from "../components/interviews/InterviewResult";
import { TRACK_FULL, accessState, fmtClock, fmtDuration, openQuestion } from "./live/liveFormat";

// Живой экран интервьюера (/interviews/:id/live): без сайдбара, три колонки.
export default function LiveInterview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { view, load, offline, drafts, busy, rate, questionAction, accessAction, finish, retry } = useLiveSession(id);
  const [selected, setSelected] = useState(null);
  const [lang, setLang] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [creds, setCreds] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const open = view ? openQuestion(view.questions) : null;
  // Центр следует за открытым вопросом; клик по списку выбирает любой.
  useEffect(() => {
    if (!view) return;
    setSelected((cur) => {
      if (open) return open.code;
      if (cur && view.questions.some((q) => q.code === cur)) return cur;
      return (view.questions.find((q) => q.state === "hidden") || view.questions[0])?.code || null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.code, !!view]);
  // Язык текста вопроса следует за языком кандидата (его выбор приходит в опросе);
  // ручной переключатель UZ/RU действует до его следующей смены.
  useEffect(() => { if (view?.language) setLang(view.language); }, [view?.language]);

  const question = useMemo(() => view?.questions.find((q) => q.code === selected) || null, [view, selected]);

  if (load.state === "loading" && !view) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center h-screen gap-3 text-slate-400">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm">Загрузка собеседования…</p>
        </div>
      </Shell>
    );
  }
  if (load.state === "error" || !view) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center h-screen gap-1 text-center px-4">
          <p className="text-sm font-medium text-slate-700">Не удалось загрузить собеседование</p>
          <p className="text-xs text-slate-400">{load.message || "Сессия не найдена или уже завершена."}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={retry} className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">Повторить</button>
            <Link to="/interviews" className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">К списку</Link>
          </div>
        </div>
      </Shell>
    );
  }

  const access = view.access;
  const acc = accessState(access, now);
  const ended = view.status === "finished" || view.status === "aborted";
  const startedMin = view.startedAt ? Math.max(0, Math.round((now - new Date(view.startedAt).getTime()) / 60000)) : null;
  const disabled = busy || ended;

  const doAction = async (code, action) => {
    const v = await questionAction(code, action);
    if (v) setSelected(code);
  };
  const resetPassword = async () => {
    if (!window.confirm("Сбросить пароль? Старый перестанет работать, кандидата выкинет из сессии.")) return;
    const v = await accessAction("reset");
    if (v?.credentials) setCreds(v.credentials);
  };
  const extend = async () => {
    const v = await accessAction("extend", { minutes: 30 });
    if (v) toast.success("Доступ продлён на 30 минут");
  };
  const doFinish = async () => {
    setFinishing(true);
    const v = await finish();
    if (!v) { setFinishing(false); return; }
    let iv = null;
    try { iv = await api.interviews.getOne(id); } catch { /* итог покажем по баллу сессии */ }
    const interview = iv?.interview || iv;
    const s = v.score || {};
    setResult({
      result: interview && interview.percentage !== undefined ? interview : {
        percentage: s.percentage, scoreEarned: s.earned, scoreTotal: s.total, passed: s.passed, application: interview?.application,
      },
      letter: v.letter,
    });
    setConfirmFinish(false);
    setFinishing(false);
  };

  const name = view.interview?.candidate || "Кандидат";
  const chip = (() => {
    if (acc.kind === "online") return { cls: "bg-green-50 text-green-700", dot: "bg-green-500", text: `Кандидат в сети · ${(view.language || "uz").toUpperCase()}` };
    if (acc.kind === "offline") return { cls: "bg-slate-100 text-slate-600", dot: "bg-slate-400", text: `Кандидат не на связи${acc.ago != null ? ` ${fmtDuration(acc.ago)}` : ""}` };
    if (acc.kind === "never") return { cls: "bg-slate-100 text-slate-600", dot: "bg-slate-300", text: "Кандидат ещё не вошёл" };
    if (acc.kind === "expired") return { cls: "bg-red-50 text-red-700", dot: "bg-red-500", text: "Доступ истёк" };
    return { cls: "bg-slate-100 text-slate-600", dot: "bg-slate-300", text: "Доступ отозван" };
  })();

  return (
    <Shell>
      <div className="lg:hidden min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-base font-semibold text-slate-900">Откройте на ноутбуке</p>
        <p className="text-sm text-slate-500">Живому экрану собеседования нужны три колонки — на узком экране он не помещается.</p>
        <Link to="/interviews" className="text-sm text-blue-600 hover:underline">К списку собеседований</Link>
      </div>

      <div className="hidden lg:flex min-h-screen flex-col">
        <header className="h-14 bg-white shadow flex items-center gap-4 px-5 shrink-0">
          <Link to="/interviews" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4" /> Собеседования
          </Link>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-400">
              {TRACK_FULL[view.track] || view.track}{view.set ? ` · набор №${view.set.number}` : ""}
              {startedMin != null ? ` · идёт ${startedMin} мин` : ""}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${chip.cls}`}>
            <span className={`w-2 h-2 rounded-full ${chip.dot}`} /> {chip.text}
          </span>
          {access && <span className="text-xs text-slate-400">доступ до {fmtClock(access.expiresAt)}</span>}
          <div className="flex-1" />
          <button onClick={resetPassword} disabled={disabled || offline}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50">
            <KeyRound className="w-3.5 h-3.5" /> Сбросить пароль
          </button>
          <button onClick={() => setConfirmFinish(true)} disabled={disabled || offline}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50">
            <Flag className="w-4 h-4" /> Завершить
          </button>
        </header>

        {offline && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            <WifiOff className="w-4 h-4 shrink-0" />
            <p>Нет связи с сервером, переподключаемся каждые 5 с. Оценки и заметки отправятся, когда связь вернётся. Кнопки «Открыть» и «Завершить» пока недоступны.</p>
          </div>
        )}
        {ended && (
          <div className="mx-4 mt-4 rounded-lg bg-slate-100 border border-slate-200 px-3 py-2 text-xs text-slate-600">
            Собеседование {view.status === "finished" ? "завершено" : "прервано"}. Экран только для чтения.
          </div>
        )}
        {!ended && acc.kind === "never" && (
          <div className="mx-4 mt-4 flex items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-300" /> Кандидат ещё не вошёл · <span className="font-mono">{access?.username}</span>
            </span>
            <button onClick={resetPassword} disabled={disabled || offline} className="text-blue-600 hover:underline font-medium disabled:opacity-50">Сбросить пароль</button>
          </div>
        )}
        {!ended && acc.kind === "expired" && (
          <div className="mx-4 mt-4 flex items-center justify-between gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <span className="inline-flex items-center gap-2">
              <Clock className="w-4 h-4" /> Доступ кандидата истёк в {fmtClock(access?.expiresAt)}. Он больше не может отправлять ответы. Оценивать и завершать можно.
            </span>
            <button onClick={extend} disabled={busy || offline} className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-red-200 hover:bg-red-100 rounded-lg disabled:opacity-50">Продлить на 30 мин</button>
          </div>
        )}
        {!ended && acc.kind === "offline" && (
          <p className="mx-4 mt-4 text-xs text-slate-500">
            Черновик ответа сохранён на сервере и у кандидата. Он может войти заново тем же логином. Подсказка появляется после 20 с без запросов
            {access?.lastSeenAt ? ` · последний запрос ${fmtClock(access.lastSeenAt)}` : ""}.
          </p>
        )}

        <div className="flex-1 grid grid-cols-[370px_1fr_380px] gap-4 p-4 min-h-0">
          <QuestionList questions={view.questions} drafts={drafts} selected={selected} lang={lang || "uz"} onSelect={setSelected} />
          <section className="space-y-4 min-w-0">
            {question && (
              <QuestionPanel question={question} questions={view.questions} lang={lang || "uz"} onLang={setLang}
                onAction={doAction} disabled={disabled} offline={offline} />
            )}
          </section>
          <section className="space-y-4 min-w-0">
            <ScoreCard score={view.score} />
            {question && (
              <CandidateAnswer key={question.code} question={question} drafts={drafts} onRate={rate} offline={offline} lang={lang || "uz"} />
            )}
            <SignalsList signals={view.signals} />
          </section>
        </div>
      </div>

      {confirmFinish && <FinishModal view={view} saving={finishing} onCancel={() => setConfirmFinish(false)} onConfirm={doFinish} />}
      {creds && (
        <CandidateAccessModal credentials={creds} candidate={name}
          subtitle={`${TRACK_FULL[view.track] || view.track} · новый пароль`} onOpenLive={() => setCreds(null)} />
      )}
      {result && (
        <InterviewResultModal name={name} trackLabel={TRACK_FULL[view.track]} result={result.result} letter={result.letter}
          onSaved={() => {}} onClose={() => navigate("/interviews")} />
      )}
      <ToastContainer position="top-right" />
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen bg-base-200">{children}</div>;
}
