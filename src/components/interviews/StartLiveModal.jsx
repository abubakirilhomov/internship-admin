import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../../utils/api";
import {
  BANK_TRACKS, LEVELS, LEVEL_ORDER, composition, compositionText, expectedText, fmtClock, fmtShortDate,
  questionShort, SIZE_OPTIONS, overlapText,
} from "../../pages/live/liveFormat";

const radio = (on) => (
  <span className={`mt-0.5 w-4 h-4 rounded-full shrink-0 ${on ? "border-4 border-blue-600" : "border border-slate-300"}`} />
);

// Список вопросов набора с ответами банка (по ссылке «Посмотреть вопросы»).
function QuestionsPreview({ codes, bankByCode }) {
  const [open, setOpen] = useState(null);
  return (
    <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg text-xs">
      {codes.map((c, i) => {
        const q = bankByCode.get(c);
        if (!q) return <li key={c} className="px-3 py-1.5 text-slate-400">{c} — нет в банке</li>;
        const lv = LEVELS[q.level];
        return (
          <li key={c} className="px-3 py-1.5">
            <button type="button" onClick={() => setOpen(open === c ? null : c)} className="w-full flex items-center gap-2 text-left">
              <span className="w-4 text-slate-400 text-right">{i + 1}</span>
              <span className="font-mono text-slate-500 w-8">{c}</span>
              <span className="flex-1 truncate text-slate-700">{questionShort(q, "ru")}</span>
              {lv && <span className={`px-1.5 py-0.5 rounded ${lv.cls}`}>{lv.label}</span>}
            </button>
            {open === c && (
              <div className="mt-1.5 ml-6 rounded-lg bg-amber-50 border border-amber-200 p-2 text-slate-700 whitespace-pre-wrap">
                {expectedText(q, "ru") || "Ответ в банке не заполнен"}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// a1: «Начать собеседование» — направление, набор, выдача доступа.
// onStarted(view) получает LiveView с credentials (пароль виден один раз).
export default function StartLiveModal({ interview, modes, onClose, onStarted }) {
  const a = interview.application || {};
  const name = `${a.firstName || ""} ${a.lastName || ""}`.trim() || "Кандидат";
  const isLive = (t) => modes?.[t] === "live";
  const [track, setTrack] = useState(isLive(interview.track) ? interview.track : (BANK_TRACKS.find((t) => isLive(t.value))?.value || interview.track));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [choice, setChoice] = useState("suggested");
  const [otherId, setOtherId] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [size, setSize] = useState(18);
  const [bank, setBank] = useState([]);
  const [showList, setShowList] = useState(false);
  const [saving, setSaving] = useState(false);

  // Наборы направления + вопросы банка (для состава и просмотра).
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setPreview(null); setChoice("suggested"); setShowList(false);
    (async () => {
      try {
        const [s, q] = await Promise.all([
          api.interviews.live.sets({ interviewId: interview._id, track }),
          api.questionBank.questions({ track }),
        ]);
        if (cancelled) return;
        setData(s);
        setSize(s.defaultSize || 18);
        setBank(q.questions || []);
        const first = (s.sets || []).find((x) => x._id !== s.suggestedSetId);
        setOtherId(first?._id || "");
      } catch (e) {
        if (!cancelled) setError(e.message || "Не удалось загрузить наборы");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [interview._id, track]);

  const bankByCode = useMemo(() => new Map(bank.map((q) => [q.code, q])), [bank]);
  const sets = data?.sets || [];
  const suggested = sets.find((s) => s._id === data?.suggestedSetId) || null;
  const other = sets.find((s) => s._id === otherId) || null;

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const r = await api.interviews.live.preview({ track, interviewId: interview._id, size });
      setPreview(r);
    } catch (e) {
      setPreview(null);
      toast.error(e.message || "Не удалось сгенерировать набор");
    } finally {
      setPreviewing(false);
    }
  };
  useEffect(() => {
    if (choice === "generate" && !preview && !previewing && data) runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, data, size]);

  const chosenCodes = choice === "suggested" ? suggested?.questionCodes
    : choice === "other" ? other?.questionCodes
    : preview?.questionCodes;
  const comp = useMemo(() => composition(chosenCodes || [], bankByCode), [chosenCodes, bankByCode]);
  const violations = choice === "generate" ? preview?.violations || [] : [];
  const canStart = !loading && !saving && !!chosenCodes?.length && violations.length === 0 && data?.mode === "live";

  // Окно доступа: с «время − 30 мин» до «max(время, сейчас) + 3 ч» (как в int-server).
  const sched = new Date(interview.scheduledAt);
  const from = new Date(sched.getTime() - 30 * 60000);
  const to = new Date(Math.max(sched.getTime(), Date.now()) + 3 * 3600000);

  const submit = async () => {
    setSaving(true);
    try {
      const body = { track };
      if (choice === "generate") { body.generate = true; body.size = size; body.questionCodes = preview.questionCodes; }
      else body.setId = choice === "suggested" ? suggested._id : other._id;
      const view = await api.interviews.live.start(interview._id, body);
      onStarted(view);
    } catch (e) {
      toast.error(e.message || "Не удалось выдать доступ");
      setSaving(false);
    }
  };

  const used = (s) => (s.usedCount ? `использовался ${s.usedCount} раз, последний ${fmtShortDate(s.lastUsedAt)}` : "ещё не использовался");
  const retake = !!data?.retake?.isRetake;
  const overlapOf = (s) => (retake ? ` · ${overlapText(s.overlap || 0)} с прошлой попыткой` : "");
  const levelsText = (c) => `уровни ${LEVEL_ORDER.map((l) => c.levels[l]).join(" / ")}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Начать собеседование</h2>
            <p className="text-xs text-slate-400">{name} · {new Date(interview.scheduledAt).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Закрыть"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Направление</label>
            <div className="inline-flex rounded-xl bg-slate-100 p-1 w-full">
              {BANK_TRACKS.map((t) => {
                const live = isLive(t.value);
                return (
                  <button key={t.value} type="button" disabled={!live} title={live ? "" : "Банка пока нет"}
                    onClick={() => setTrack(t.value)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium ${t.value === track ? "bg-white text-slate-900 shadow" : live ? "text-slate-500 hover:text-slate-700" : "text-slate-300 cursor-not-allowed"}`}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Набор вопросов</label>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm">Загрузка наборов…</span>
              </div>
            ) : error ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            ) : data?.mode !== "live" ? (
              <p className="text-sm text-slate-500">Банка для этого направления пока нет — только чек-лист.</p>
            ) : (
              <div className="space-y-2">
                {retake && (
                  <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    Пересдача: прошлых вопросов кандидата — {data.retake.priorQuestions}. Предложен набор с наименьшим пересечением.
                  </p>
                )}
                {suggested && (
                  <button type="button" onClick={() => setChoice("suggested")}
                    className={`w-full flex gap-3 p-3 rounded-lg border text-left ${choice === "suggested" ? "border-blue-400 bg-blue-50/50" : "border-slate-200"}`}>
                    {radio(choice === "suggested")}
                    <span className="text-sm">
                      <span className={choice === "suggested" ? "font-medium text-slate-900" : "text-slate-900"}>Набор №{suggested.number} — следующий по ротации</span><br />
                      <span className="text-xs text-slate-500">
                        {used(suggested)} · {suggested.size} вопросов · {levelsText(composition(suggested.questionCodes, bankByCode))}{overlapOf(suggested)}
                      </span>
                    </span>
                  </button>
                )}
                <div role="button" tabIndex={0} onClick={() => setChoice("generate")}
                  onKeyDown={(e) => { if (e.key === "Enter") setChoice("generate"); }}
                  className={`w-full flex gap-3 p-3 rounded-lg border text-left cursor-pointer ${choice === "generate" ? "border-blue-400 bg-blue-50/50" : "border-slate-200"}`}>
                  {radio(choice === "generate")}
                  <span className="text-sm flex-1">
                    <span className={choice === "generate" ? "font-medium text-slate-900" : "text-slate-900"}>Сгенерировать новый по правилу</span><br />
                    <span className="text-xs text-slate-500">без вопросов трёх прошлых собеседований{retake ? " и прошлой попытки кандидата" : ""}</span>
                  <label className="mt-2 flex items-center gap-1.5 text-xs text-slate-500" onClick={(e) => e.stopPropagation()}>
                    Вопросов
                    <select value={size} aria-label="Количество вопросов" onChange={(e) => { setSize(Number(e.target.value)); setPreview(null); setChoice("generate"); }}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:border-blue-400">
                      {SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  </span>
                </div>
                {sets.length > 1 && (
                  <div className={`flex gap-3 p-3 rounded-lg border items-center ${choice === "other" ? "border-blue-400 bg-blue-50/50" : "border-slate-200"}`}
                    onClick={() => setChoice("other")}>
                    {radio(choice === "other")}
                    <span className="text-sm text-slate-900 flex-1">Выбрать другой</span>
                    <select value={otherId} onChange={(e) => { setOtherId(e.target.value); setChoice("other"); }}
                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:border-blue-400">
                      {sets.filter((s) => s._id !== data.suggestedSetId).map((s) => (
                        <option key={s._id} value={s._id}>№{s.number} · {s.size} в. · {s.lastUsedAt ? fmtShortDate(s.lastUsedAt) : "новый"}{retake ? ` · ${overlapText(s.overlap || 0)}` : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {!loading && !error && data?.mode === "live" && (
            <>
              {choice === "generate" && previewing && <p className="text-xs text-slate-400">Собираем набор…</p>}
              {violations.length > 0 && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-0.5">
                  {violations.map((v, i) => <p key={i}>{typeof v === "string" ? v : v.message || JSON.stringify(v)}</p>)}
                </div>
              )}
              {chosenCodes?.length > 0 && (
                <div className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <span>{compositionText(comp)}{" · "}{levelsText(comp)}{choice === "generate" && retake && preview ? ` · ${overlapText(preview.overlap || 0)} с прошлой попыткой` : ""}</span>
                    <button type="button" onClick={() => setShowList((v) => !v)} className="shrink-0 inline-flex items-center gap-0.5 text-blue-600 hover:underline font-medium">
                      Посмотреть вопросы {showList ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}
              {choice === "generate" && preview?.repeated?.length > 0 && (
                <p className="text-xs text-slate-500">
                  Из недавних собеседований повторяется вопросов: {preview.repeated.length} — банк не позволяет набрать полностью новые под правило уровней.
                </p>
              )}
              {showList && chosenCodes?.length > 0 && <QuestionsPreview codes={chosenCodes} bankByCode={bankByCode} />}
              <p className="text-xs text-slate-500">
                Кандидат получит разовый логин. Он действует с {fmtClock(from)} до {fmtClock(to)} (Ташкент) и отключается по «Завершить».
              </p>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Отмена</button>
          <button onClick={submit} disabled={!canStart}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-60">
            {saving ? "Выдача…" : "Выдать доступ"}
          </button>
        </div>
      </div>
    </div>
  );
}
