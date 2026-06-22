import React, { useEffect, useState, useCallback } from "react";
import { api } from "../utils/api";
import { toast, ToastContainer } from "react-toastify";
import {
  CalendarPlus, Clock, Phone, RefreshCw, UserX, X, Search,
  ClipboardCheck, Ban, CalendarClock, Copy, Check, FileText,
} from "lucide-react";

const TRACKS = [
  { value: "", label: "Все направления" },
  { value: "frontend-react", label: "Frontend (React)" },
  { value: "backend-nodejs", label: "Backend (Node.js)" },
];
const TRACK_LABEL = {
  "frontend-react": "Frontend React",
  "backend-nodejs": "Backend Node",
};

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (d) =>
  new Date(d).toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit", month: "short" });

// Date → значение для <input type="datetime-local"> (локальное время).
const toLocalInput = (d) => {
  const dt = new Date(d);
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function RescheduleModal({ interview, onClose, onSaved }) {
  const [when, setWhen] = useState(toLocalInput(interview.scheduledAt));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!when) return toast.error("Укажите дату и время");
    setSaving(true);
    try {
      await api.interviews.reschedule(interview._id, new Date(when).toISOString());
      toast.success("Время перенесено");
      onSaved();
    } catch (e) {
      toast.error(e.message || "Не удалось перенести");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Перенести собеседование</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Новые дата и время</label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60">
            {saving ? "Сохранение…" : "Перенести"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Повторное собеседование (пересдача): создаёт новую попытку для той же
// заявки, перенося проваленные темы (roadmap) в фокус следующего собеса.
function ReInterviewModal({ iv, onClose, onSaved }) {
  const cd = iv.cooldownUntil ? new Date(iv.cooldownUntil) : null;
  const base = cd && cd > new Date() ? cd : new Date(Date.now() + 7 * 86400000);
  const [when, setWhen] = useState(toLocalInput(base));
  const [ignoreCooldown, setIgnoreCooldown] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!when) return toast.error("Укажите дату и время");
    setSaving(true);
    try {
      await api.interviews.schedule({
        applicationId: iv.application?._id,
        scheduledAt: new Date(when).toISOString(),
        track: iv.track,
        fromInterviewId: iv._id,
        ignoreCooldown,
      });
      toast.success("Повторное собеседование запланировано");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e.message || "Не удалось запланировать");
    } finally {
      setSaving(false);
    }
  };

  const roadmap = Array.isArray(iv.roadmap) ? iv.roadmap : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Повторное собеседование</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-500">
            Направление: <span className="font-medium text-slate-700">{TRACK_LABEL[iv.track] || iv.track}</span>
          </p>
          {roadmap.length > 0 && (
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">
              <span className="font-medium">Фокус повторного собеса:</span> {roadmap.join(", ")}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Дата и время</label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          {cd && (
            <p className="text-xs text-slate-400">
              Кулдаун до {cd.toLocaleDateString("ru-RU")}.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={ignoreCooldown}
              onChange={(e) => setIgnoreCooldown(e.target.checked)}
              className="rounded border-slate-300"
            />
            Игнорировать кулдаун
          </label>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60">
            {saving ? "Планирование…" : "Запланировать"}
          </button>
        </div>
      </div>
    </div>
  );
}

const MARK_CYCLE = ["none", "pass", "partial", "fail"];
const MARK_META = {
  none: { label: "—", cls: "bg-slate-100 text-slate-400" },
  pass: { label: "✓", cls: "bg-green-500 text-white" },
  partial: { label: "½", cls: "bg-amber-400 text-white" },
  fail: { label: "✗", cls: "bg-red-500 text-white" },
};
const CATS = [
  { value: "html-css", label: "HTML / CSS" },
  { value: "javascript", label: "JavaScript" },
  { value: "react", label: "React" },
  { value: "practical", label: "Практика / ТЗ" },
];
// Превью %/вердикта на клиенте (источник истины — сервер при сохранении).
const PARTIAL = 0.5;
const THRESHOLD = 80;

function ScoringModal({ interview, onClose, onSaved }) {
  const [topics, setTopics] = useState([]);
  const [loadingT, setLoadingT] = useState(true);
  const [marks, setMarks] = useState({});
  const [phase, setPhase] = useState("grading");
  const [result, setResult] = useState(null);
  const [letter, setLetter] = useState(null);
  const [lang, setLang] = useState("ru");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [account, setAccount] = useState(null);
  const [accCopied, setAccCopied] = useState(false);

  // Фокус пересдачи: темы из roadmap прошлой попытки. По умолчанию показываем
  // только их (с переключателем «показать все»).
  const focusSet = new Set((interview.focusTopics || []).map(String));
  const [showAll, setShowAll] = useState(focusSet.size === 0);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.interviewTopics.getAll({ track: interview.track });
        setTopics(Array.isArray(data) ? data : []);
      } catch (e) {
        toast.error(e.message || "Не удалось загрузить темы");
      } finally {
        setLoadingT(false);
      }
    })();
  }, [interview.track]);

  const setMark = (id) =>
    setMarks((m) => {
      const cur = m[id] || "none";
      return { ...m, [id]: MARK_CYCLE[(MARK_CYCLE.indexOf(cur) + 1) % MARK_CYCLE.length] };
    });

  const visibleTopics = showAll
    ? topics
    : topics.filter((t) => focusSet.has(String(t._id)));

  let earned = 0, total = 0;
  for (const t of topics) {
    const r = marks[t._id] || "none";
    if (r === "none") continue;
    const w = Number(t.weight) || 1;
    total += w;
    if (r === "pass") earned += w;
    else if (r === "partial") earned += w * PARTIAL;
  }
  earned = Math.round(earned * 100) / 100;
  const pct = total > 0 ? Math.round((earned / total) * 1000) / 10 : 0;
  const livePass = pct >= THRESHOLD;

  const save = async () => {
    const items = topics
      .filter((t) => (marks[t._id] || "none") !== "none")
      .map((t) => ({ topicId: t._id, result: marks[t._id] }));
    if (items.length === 0) return toast.error("Отметьте хотя бы одну тему");
    setSaving(true);
    try {
      const res = await api.interviews.score(interview._id, items);
      setResult(res.interview);
      setLetter(res.letter);
      setPhase("result");
      onSaved();
    } catch (e) {
      toast.error(e.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter?.[lang] || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  // Фаза 3: создать аккаунт интерна из прошедшей заявки (reuse convert).
  const createAccount = async () => {
    const appId = result?.application?._id;
    if (!appId) return toast.error("Нет заявки кандидата");
    setCreating(true);
    try {
      const r = await api.applications.convert(appId);
      setAccount({ username: r.intern?.username || "", tempPassword: r.tempPassword || "" });
      toast.success("Аккаунт создан");
      onSaved();
    } catch (e) {
      toast.error(e.message || "Не удалось создать аккаунт");
    } finally {
      setCreating(false);
    }
  };
  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(`Логин: ${account.username}\nПароль: ${account.tempPassword}`);
      setAccCopied(true);
      setTimeout(() => setAccCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const a = interview.application || {};
  const name = `${a.firstName || ""} ${a.lastName || ""}`.trim() || "Кандидат";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{phase === "grading" ? "Оценка собеседования" : "Результат"}</h2>
            <p className="text-xs text-slate-400">{name} · {TRACK_LABEL[interview.track] || interview.track}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        {phase === "grading" ? (
          <>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {loadingT ? (
                <p className="text-sm text-slate-400 text-center py-8">Загрузка тем…</p>
              ) : topics.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Банк пуст для этого направления. Засей банк или добавь темы.</p>
              ) : (
                <>
                {focusSet.size > 0 && (
                  <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    <span className="text-slate-500">
                      {showAll ? "Показаны все темы" : `Только темы на повтор (${visibleTopics.length})`}
                    </span>
                    <button
                      onClick={() => setShowAll((s) => !s)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {showAll ? "Только темы на повтор" : "Показать все темы"}
                    </button>
                  </div>
                )}
                {CATS.map((c) => {
                  const list = visibleTopics.filter((t) => t.category === c.value);
                  if (!list.length) return null;
                  return (
                    <div key={c.value}>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1.5">{c.label}</p>
                      <div className="space-y-1">
                        {list.map((t) => {
                          const r = marks[t._id] || "none";
                          const meta = MARK_META[r];
                          return (
                            <div key={t._id} className="flex items-center gap-2">
                              <button onClick={() => setMark(t._id)} className={`w-7 h-7 rounded-lg text-sm font-bold flex-shrink-0 ${meta.cls}`} title="Клик: — → ✓ → ½ → ✗">{meta.label}</button>
                              <span className="text-sm text-slate-700 flex-1">{t.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-slate-500">Балл: {earned}/{total}</span>
                <span className={`font-semibold ${livePass ? "text-green-600" : "text-slate-700"}`}>
                  {pct}%{total > 0 ? (livePass ? " · проходит" : ` · нужно ≥${THRESHOLD}%`) : ""}
                </span>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
                <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60">
                  {saving ? "Сохранение…" : "Сохранить результат"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <div className={`rounded-xl p-4 text-center ${result?.passed ? "bg-green-50" : "bg-red-50"}`}>
              <p className={`text-3xl font-bold ${result?.passed ? "text-green-600" : "text-red-500"}`}>{result?.percentage}%</p>
              <p className="text-sm text-slate-600 mt-1">{result?.scoreEarned}/{result?.scoreTotal} · {result?.passed ? "Прошёл ✅" : "Не прошёл ❌"}</p>
            </div>

            {result?.passed && (
              account ? (
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-green-800">Аккаунт интерна создан ✅</p>
                  <p className="text-sm"><span className="text-slate-500">Логин:</span> <code className="font-mono">{account.username}</code></p>
                  <p className="text-sm"><span className="text-slate-500">Пароль:</span> <code className="font-mono">{account.tempPassword}</code></p>
                  <button onClick={copyAccount} className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-white border border-green-200 text-green-700 hover:bg-green-50">
                    {accCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {accCopied ? "Скопировано" : "Скопировать"}
                  </button>
                  <p className="text-xs text-slate-400">Пароль показывается один раз — передай кандидату.</p>
                </div>
              ) : (
                <button onClick={createAccount} disabled={creating} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-60">
                  {creating ? "Создание…" : "Создать аккаунт интерна"}
                </button>
              )
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Письмо кандидату</p>
                <div className="flex items-center gap-1">
                  {["ru", "uz"].map((l) => (
                    <button key={l} onClick={() => setLang(l)} className={`px-2 py-0.5 rounded text-xs font-medium ${lang === l ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{l.toUpperCase()}</button>
                  ))}
                  <button onClick={copy} className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Скопировано" : "Копировать"}
                  </button>
                </div>
              </div>
              <textarea readOnly value={letter?.[lang] || ""} rows={10} className="w-full text-sm p-3 rounded-lg border border-slate-200 bg-slate-50 resize-none" />
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Готово</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InterviewCard({ iv, onChanged }) {
  const a = iv.application || {};
  const name = `${a.firstName || ""} ${a.lastName || ""}`.trim() || "—";
  const teacher = a.mentor ? `${a.mentor.name || ""} ${a.mentor.lastName || ""}`.trim() : "";
  const [busy, setBusy] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showScoring, setShowScoring] = useState(false);

  const setStatus = async (status) => {
    setBusy(true);
    try {
      await api.interviews.updateStatus(iv._id, status);
      toast.success("Статус обновлён");
      onChanged();
    } catch (e) {
      toast.error(e.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {fmtTime(iv.scheduledAt)}
            </span>
            <span className="text-xs text-slate-400">{fmtDay(iv.scheduledAt)}</span>
            {iv.attemptNumber > 1 && (
              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-700">
                попытка {iv.attemptNumber}
              </span>
            )}
          </div>
          <p className="mt-1 font-medium text-slate-900 truncate">
            {name}{a.age ? <span className="text-slate-400 font-normal">, {a.age} лет</span> : null}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{TRACK_LABEL[iv.track] || iv.track}</span>
            {teacher && <span>Учитель: {teacher}</span>}
            {a.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{a.phone}</span>}
            {a.telegramUsername && <span>@{a.telegramUsername}</span>}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <a
          href={iv.calendarLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
        >
          <CalendarPlus className="w-3.5 h-3.5" /> В календарь
        </a>
        <button onClick={() => setShowReschedule(true)} disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">
          <RefreshCw className="w-3.5 h-3.5" /> Перенести
        </button>
        <button onClick={() => setShowScoring(true)} disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg disabled:opacity-50">
          <ClipboardCheck className="w-3.5 h-3.5" /> Оценить
        </button>
        <button onClick={() => setStatus("no_show")} disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-orange-700 hover:bg-orange-50 rounded-lg disabled:opacity-50">
          <UserX className="w-3.5 h-3.5" /> Не пришёл
        </button>
        <button onClick={() => setStatus("canceled")} disabled={busy}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-100 rounded-lg disabled:opacity-50">
          <Ban className="w-3.5 h-3.5" /> Отменить
        </button>
      </div>

      {showReschedule && (
        <RescheduleModal
          interview={iv}
          onClose={() => setShowReschedule(false)}
          onSaved={() => { setShowReschedule(false); onChanged(); }}
        />
      )}

      {showScoring && (
        <ScoringModal
          interview={iv}
          onClose={() => setShowScoring(false)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}

const Section = ({ title, icon: Icon, accent, items, onChanged }) => {
  if (!items.length) return null;
  return (
    <div className="mb-6">
      <h2 className={`flex items-center gap-2 text-sm font-semibold mb-2 ${accent}`}>
        <Icon className="w-4 h-4" /> {title}
        <span className="text-slate-400 font-normal">({items.length})</span>
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((iv) => <InterviewCard key={iv._id} iv={iv} onChanged={onChanged} />)}
      </div>
    </div>
  );
};

// Письмо-результат по уже оценённому собесу (RU/UZ + копировать).
function LetterModal({ interviewId, candidate, onClose }) {
  const [letter, setLetter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState("ru");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.interviews.letter(interviewId);
        setLetter(data.letter);
      } catch (e) {
        toast.error(e.message || "Не удалось получить письмо");
      } finally {
        setLoading(false);
      }
    })();
  }, [interviewId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter?.[lang] || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Письмо · {candidate}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Загрузка…</p>
          ) : (
            <>
              <div className="flex items-center justify-end gap-1 mb-2">
                {["ru", "uz"].map((l) => (
                  <button key={l} onClick={() => setLang(l)} className={`px-2 py-0.5 rounded text-xs font-medium ${lang === l ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>{l.toUpperCase()}</button>
                ))}
                <button onClick={copy} className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "Скопировано" : "Копировать"}
                </button>
              </div>
              <textarea readOnly value={letter?.[lang] || ""} rows={10} className="w-full text-sm p-3 rounded-lg border border-slate-200 bg-slate-50 resize-none" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ iv, onScheduled }) {
  const a = iv.application || {};
  const name = `${a.firstName || ""} ${a.lastName || ""}`.trim() || "—";
  const teacher = a.mentor ? `${a.mentor.name || ""} ${a.mentor.lastName || ""}`.trim() : "";
  const when = iv.conductedAt
    ? new Date(iv.conductedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const [showLetter, setShowLetter] = useState(false);
  const [showReInterview, setShowReInterview] = useState(false);
  const passed = iv.passed;
  const canRetake = iv.status === "completed" && passed === false && !a.convertedToIntern;

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-900 truncate">
            {name}{a.age ? <span className="text-slate-400 font-normal">, {a.age} лет</span> : null}
          </p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{TRACK_LABEL[iv.track] || iv.track}</span>
            <span>{when}</span>
            {teacher && <span>Учитель: {teacher}</span>}
            {iv.attemptNumber > 1 && <span className="text-amber-600">попытка {iv.attemptNumber}</span>}
          </div>
        </div>
        <div className={`text-right flex-shrink-0 ${passed ? "text-green-600" : "text-red-500"}`}>
          <div className="text-xl font-bold leading-none">{iv.percentage}%</div>
          <div className="text-[11px] mt-0.5">{iv.scoreEarned}/{iv.scoreTotal} · {passed ? "прошёл" : "не прошёл"}</div>
        </div>
      </div>

      {Array.isArray(iv.roadmap) && iv.roadmap.length > 0 && (
        <div className="mt-2 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Темы на повтор:</span> {iv.roadmap.join(", ")}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setShowLetter(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
          <FileText className="w-3.5 h-3.5" /> Письмо
        </button>
        {canRetake && (
          <button onClick={() => setShowReInterview(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg">
            <RefreshCw className="w-3.5 h-3.5" /> Повторное собеседование
          </button>
        )}
        {passed && a.convertedToIntern && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">✓ аккаунт создан</span>
        )}
        {passed && !a.convertedToIntern && (
          <span className="text-xs text-amber-600">аккаунт не создан</span>
        )}
      </div>

      {showLetter && <LetterModal interviewId={iv._id} candidate={name} onClose={() => setShowLetter(false)} />}
      {showReInterview && (
        <ReInterviewModal
          iv={iv}
          onClose={() => setShowReInterview(false)}
          onSaved={() => onScheduled && onScheduled()}
        />
      )}
    </div>
  );
}

export default function Interviews() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState("");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("scheduled"); // scheduled | completed

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.interviews.getAll({ status: mode, track, q });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      toast.error(e.message || "Не удалось загрузить");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [track, q, mode]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const today0 = startOfToday().getTime();
  const today1 = endOfToday().getTime();
  const overdue = items.filter((i) => new Date(i.scheduledAt).getTime() < today0);
  const today = items.filter((i) => {
    const t = new Date(i.scheduledAt).getTime();
    return t >= today0 && t <= today1;
  });
  const upcoming = items.filter((i) => new Date(i.scheduledAt).getTime() > today1);
  const completedSorted = [...items].sort(
    (a, b) => new Date(b.conductedAt || b.updatedAt || 0) - new Date(a.conductedAt || a.updatedAt || 0)
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Собеседования</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {mode === "scheduled"
              ? "Запланированные собесы. Планируются со страницы «Заявки»."
              : "Проведённые собеседования — результаты и история."}
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1 self-start">
          {[["scheduled", "Запланированные"], ["completed", "Проведённые"]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${mode === v ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-700"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-4 mb-5 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по имени, телефону, телеграму…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <select
          value={track}
          onChange={(e) => setTrack(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-400"
        >
          {TRACKS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm">Загрузка…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{mode === "scheduled" ? "Нет запланированных собеседований." : "Проведённых собеседований пока нет."}</p>
        </div>
      ) : mode === "scheduled" ? (
        <>
          <Section title="Просрочено" icon={CalendarClock} accent="text-red-600" items={overdue} onChanged={load} />
          <Section title="Сегодня" icon={Clock} accent="text-purple-700" items={today} onChanged={load} />
          <Section title="Скоро" icon={CalendarPlus} accent="text-slate-600" items={upcoming} onChanged={load} />
        </>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {completedSorted.map((iv) => (
            <ResultCard key={iv._id} iv={iv} onScheduled={() => setMode("scheduled")} />
          ))}
        </div>
      )}

      <ToastContainer position="top-right" />
    </div>
  );
}
