import React, { useEffect, useMemo, useState } from "react";
import { api } from "../utils/api";
import QuestionDemo from "../components/questionDemo/QuestionDemo";

// Просмотр банка вопросов живых собеседований (только админ): вопрос, ответ
// для интервьюера, живая сцена и её исправление. Редактирование — позже.
const TOPIC_LABEL = {
  html: "HTML", css: "CSS", js: "JavaScript", react: "React", vue: "Vue", tailwind: "Tailwind",
  node: "Node.js", express: "Express", database: "БД", api: "API",
};
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

function QuestionCard({ q, lang }) {
  const ru = lang === "ru";
  const prompt = (ru && q.promptRu) || q.prompt;
  const answer = (ru && q.expectedAnswerRu) || q.expectedAnswer;
  const level = LEVEL[q.level] || { label: q.level, cls: "bg-slate-100 text-slate-600" };
  const hasDemo = !!q.demo?.html;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono font-semibold text-slate-900">{q.code}</span>
        <span className={`px-2 py-0.5 rounded-full ${level.cls}`}>{level.label}</span>
        {hasDemo && (
          <span className={`px-2 py-0.5 rounded-full ${q.demo.audience === "interviewer" ? "bg-slate-800 text-white" : "bg-blue-100 text-blue-700"}`}>
            {q.demo.audience === "interviewer" ? "сцена: только интервьюер" : "сцена: видит кандидат"}
          </span>
        )}
        {ru && q.ruStatus !== "ok" && <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">перевод: {q.ruStatus}</span>}
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

  useEffect(() => { api.questionBank.stats().then(setStats).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    setError("");
    api.questionBank.questions({ topic })
      .then((r) => setQuestions(r.questions || []))
      .catch((e) => setError(e.message || "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [topic]);

  const topics = useMemo(() => Object.keys(stats?.topics || { css: 0 }), [stats]);
  const shown = onlyDemos ? questions.filter((q) => q.demo?.html) : questions;
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
            <input type="checkbox" checked={onlyDemos} onChange={(e) => setOnlyDemos(e.target.checked)} /> только со сценами
          </label>
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

      <div className="flex flex-wrap gap-2">
        {topics.map((t) => (
          <button key={t} type="button" onClick={() => setTopic(t)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${t === topic ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>
            {TOPIC_LABEL[t] || t} {stats?.topics?.[t] ? <span className="opacity-60">{stats.topics[t]}</span> : null}
          </button>
        ))}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Загрузка…</div>
      ) : (
        <div className="space-y-4">
          {shown.map((q) => <QuestionCard key={q.code} q={q} lang={lang} />)}
          {!shown.length && <div className="text-sm text-slate-500">Нет вопросов.</div>}
        </div>
      )}
    </div>
  );
}
