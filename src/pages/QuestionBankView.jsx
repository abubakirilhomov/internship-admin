import React, { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";
import QuestionDemo from "../components/questionDemo/QuestionDemo";
import QuestionEditor from "./bank/QuestionEditor";
import { RU_STATUS } from "./bank/bankForm";
import { pyModule, sortTopics, topicLabel } from "../utils/tracks";

// Просмотр банка вопросов живых собеседований (только админ): вопрос, ответ
// для интервьюера, живая сцена и её исправление; правка, добавление, архив (этап 6).
// Python-банк: темы = модули (py-m3…py-m11, подписи с бэка); неактивные с notCovered —
// «ещё не пройдено» (модуль группа не прошла), их можно включить, когда модуль пройден.
const LEVEL = {
  oson: { label: "лёгкий", cls: "bg-green-100 text-green-700" },
  orta: { label: "средний", cls: "bg-yellow-100 text-yellow-700" },
  qiyin: { label: "сложный", cls: "bg-red-100 text-red-700" },
};

// Markdown банка: только ```-блоки кода, остальное — текст с переносами.
function RichText({ text }) {
  const parts = String(text || "").split(/```[a-z]*\n?/i);
  return (
    <div className="text-sm text-slate-800 space-y-2">
      {parts.map((p, i) =>
        i % 2 ? (
          <pre key={i} className="bg-slate-900 text-slate-100 text-xs rounded-lg p-3 overflow-x-auto">{p.replace(/\n$/, "")}</pre>
        ) : (
          p.trim() && <p key={i} className="whitespace-pre-wrap">{p.trim()}</p>
        )
      )}
    </div>
  );
}

function QuestionCard({ q, lang, onEdit, onEnable }) {
  const ru = lang === "ru";
  const prompt = (ru && q.promptRu) || q.prompt;
  const answer = (ru && q.expectedAnswerRu) || q.expectedAnswer;
  const level = LEVEL[q.level] || { label: q.level, cls: "bg-slate-100 text-slate-600" };
  const hasDemo = !!q.demo?.html;
  const notCovered = q.isActive === false && q.notCovered;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono font-semibold text-slate-900">{q.code}</span>
        <span className={`px-2 py-0.5 rounded-full ${level.cls}`}>{level.label}</span>
        {q.subtopic && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px]" data-testid="card-subtopic">{q.subtopic}</span>}
        {hasDemo && (
          <span className={`px-2 py-0.5 rounded-full ${q.demo.audience === "interviewer" ? "bg-slate-800 text-white" : "bg-blue-100 text-blue-700"}`}>
            {q.demo.audience === "interviewer" ? "сцена: только интервьюер" : "сцена: видит кандидат"}
          </span>
        )}
        {notCovered && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800" data-testid="card-not-covered">ещё не пройдено</span>}
        {q.isActive === false && !q.notCovered && <span className="px-2 py-0.5 rounded-full bg-slate-800 text-white">в архиве</span>}
        {q.tests?.length > 0 && <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">автотесты: {q.tests.length}</span>}
        {q.ruStatus !== "ok" && (
          <span className={`px-2 py-0.5 rounded-full ${RU_STATUS[q.ruStatus]?.cls || "bg-orange-100 text-orange-700"}`} data-testid="card-ru-status">
            {RU_STATUS[q.ruStatus]?.label || q.ruStatus}
          </span>
        )}
        <span className="ml-auto" />
        {notCovered && (
          <button type="button" onClick={() => onEnable(q)} data-testid={`enable-${q.code}`}
            className="px-3 py-1 rounded-lg text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100">Включить (модуль пройден)</button>
        )}
        <button type="button" onClick={() => onEdit(q)} data-testid={`edit-${q.code}`}
          className="px-3 py-1 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100">Править</button>
      </div>
      <RichText text={prompt} />
      {hasDemo && <QuestionDemo demo={q.demo} fix={q.demoFix || null} lang={lang} />}
      {answer && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800">Ответ для интервьюера</summary>
          <div className="mt-2 border-l-2 border-slate-200 pl-3"><RichText text={answer} /></div>
        </details>
      )}
    </div>
  );
}

export default function QuestionBankView() {
  const [stats, setStats] = useState(null);
  const [topic, setTopic] = useState("css");
  const [lang, setLang] = useState("ru");
  const [onlyDemos, setOnlyDemos] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [showNotCovered, setShowNotCovered] = useState(true);
  const [editing, setEditing] = useState(undefined); // undefined — закрыт, null — новый, объект — правка
  const [reload, setReload] = useState(0);

  useEffect(() => { api.questionBank.stats().then(setStats).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    setError("");
    // Неактивные (архив и «ещё не пройдено») — только по запросу; делим их на клиенте.
    api.questionBank.questions({ topic, active: showArchive || showNotCovered ? "all" : undefined })
      .then((r) => setQuestions(r.questions || []))
      .catch((e) => setError(e.message || "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [topic, showArchive, showNotCovered, reload]);

  // Темы банка: активные + те, где пока только «ещё не пройдено»; порядок как в банке (py-m10 после py-m9).
  const topics = useMemo(
    () => sortTopics([...new Set([...Object.keys(stats?.topics || { css: 0 }), ...Object.keys(stats?.notCovered || {})])]),
    [stats],
  );
  const topicGroups = [topics.filter((t) => pyModule(t) == null), topics.filter((t) => pyModule(t) != null)].filter((g) => g.length);
  const visible = questions.filter((q) => q.isActive !== false || (q.notCovered ? showNotCovered : showArchive));
  const shown = onlyDemos ? visible.filter((q) => q.demo?.html) : visible;
  const enable = async (q) => {
    if (!window.confirm(`Включить ${q.code}? Модуль пройден — вопрос попадёт в новые наборы.`)) return;
    setError("");
    try {
      await api.questionBank.updateQuestion(q.code, { isActive: true });
      api.questionBank.stats().then(setStats).catch(() => {});
      setReload((n) => n + 1);
    } catch (e) {
      setError(e.message || "Не удалось включить");
    }
  };
  const demoCount = (stats?.demos?.candidate || 0) + (stats?.demos?.interviewer || 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Банк вопросов собеседований</h1>
          <p className="text-sm text-slate-500">
            {stats ? `${stats.questions} вопросов · живых сцен: ${demoCount}` : "Загрузка…"}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox" checked={showArchive} onChange={(e) => setShowArchive(e.target.checked)} /> с архивом
          </label>
          <label className="flex items-center gap-1.5 text-slate-600" title="Вопросы модулей, которые группа ещё не прошла (неактивны)">
            <input type="checkbox" checked={showNotCovered} onChange={(e) => setShowNotCovered(e.target.checked)} data-testid="show-not-covered" /> ещё не пройденные
          </label>
          <label className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox" checked={onlyDemos} onChange={(e) => setOnlyDemos(e.target.checked)} /> только со сценами
          </label>
          <button type="button" onClick={() => setEditing(null)} data-testid="add-question"
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">+ Вопрос</button>
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            {["uz", "ru"].map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)}
                className={`px-3 py-1.5 text-xs font-medium ${lang === l ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {topicGroups.map((group) => (
          <div key={group[0]} className="flex flex-wrap items-center gap-2">
            {pyModule(group[0]) != null && <span className="text-xs font-semibold text-slate-500 uppercase mr-1">Python</span>}
            {group.map((t) => (
              <button key={t} type="button" onClick={() => setTopic(t)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${t === topic ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>
                {topicLabel(t, stats?.topicLabels)} {stats?.topics?.[t] ? <span className="opacity-60">{stats.topics[t]}</span> : null}
                {stats?.notCovered?.[t] ? <span className="opacity-60" title="ещё не пройдено"> +{stats.notCovered[t]}</span> : null}
              </button>
            ))}
          </div>
        ))}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Загрузка…</div>
      ) : (
        <div className="space-y-4">
          {shown.map((q) => <QuestionCard key={q.code} q={q} lang={lang} onEdit={setEditing} onEnable={enable} />)}
          {!shown.length && <div className="text-sm text-slate-500">Нет вопросов.</div>}
        </div>
      )}
      {editing !== undefined && (
        <QuestionEditor key={editing?.code || "new"} question={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            setEditing(undefined);
            if (saved?.topic && saved.topic !== topic) setTopic(saved.topic);
            api.questionBank.stats().then(setStats).catch(() => {}); // новая тема / включённый модуль
            setReload((n) => n + 1);
          }} />
      )}
    </div>
  );
}
