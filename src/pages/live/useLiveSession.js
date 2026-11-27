import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { api } from "../../utils/api";

const POLL_MS = 2000;
const RETRY_MS = 5000;
const NOTE_DEBOUNCE_MS = 700;

// Живая сессия интервьюера: опрос раз в 2 с с rev/304, оценки и заметки с очередью
// (при потере сети уходят после восстановления), действия над вопросами и доступом.
export default function useLiveSession(interviewId) {
  const [view, setView] = useState(null);
  const [load, setLoad] = useState({ state: "loading", message: "" }); // loading | ready | error
  const [offline, setOffline] = useState(false);
  const [drafts, setDrafts] = useState({}); // code → { result?, note? } — ещё не подтверждено сервером
  const [busy, setBusy] = useState(false);

  const viewRef = useRef(null);
  const draftsRef = useRef({});
  const offlineRef = useRef(false);
  const timerRef = useRef(null);
  const noteTimers = useRef({});
  const flushing = useRef(false);
  const alive = useRef(true);
  const loopId = useRef(0);

  const apply = useCallback((v) => {
    if (!alive.current) return;
    // Ответ старее уже применённого не затираем (гонка опроса и действия).
    if (viewRef.current && v.rev < viewRef.current.rev) return;
    viewRef.current = v;
    setView(v);
  }, []);

  const setOff = useCallback((v) => {
    offlineRef.current = v;
    if (alive.current) setOffline(v);
  }, []);

  const setDraftState = (next) => {
    draftsRef.current = next;
    setDrafts(next);
  };

  const effective = (code, key) => {
    const d = draftsRef.current[code];
    if (d && d[key] !== undefined) return d[key];
    const q = viewRef.current?.questions.find((x) => x.code === code);
    return key === "note" ? q?.note || "" : q?.result || null;
  };

  // Отправить накопившиеся оценки и заметки по одному вопросу за раз.
  const flush = useCallback(async () => {
    if (flushing.current) return true;
    flushing.current = true;
    try {
      for (;;) {
        const code = Object.keys(draftsRef.current)[0];
        if (!code) return true;
        const sent = { result: effective(code, "result"), note: effective(code, "note") };
        let v;
        try {
          v = await api.interviews.live.rate(interviewId, code, sent);
        } catch (e) {
          if (e.status && e.status < 500 && e.status !== 408 && e.status !== 429) {
            // 4xx — отправить не получится никогда: откатываем и сообщаем.
            const rest = { ...draftsRef.current }; delete rest[code];
            setDraftState(rest);
            toast.error(e.message || "Оценка не сохранена");
            continue;
          }
          setOff(true);
          return false;
        }
        apply(v);
        // Если пока шёл запрос, значение поменялось — оставляем черновик.
        const cur = draftsRef.current[code] || {};
        const keep = {};
        if (cur.result !== undefined && cur.result !== sent.result) keep.result = cur.result;
        if (cur.note !== undefined && cur.note !== sent.note) keep.note = cur.note;
        const next = { ...draftsRef.current };
        if (Object.keys(keep).length) next[code] = keep; else delete next[code];
        setDraftState(next);
      }
    } finally {
      flushing.current = false;
    }
  }, [interviewId, apply, setOff]);

  const schedulePoll = useCallback((ms, id) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => tick(id), ms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tick(id) {
    if (!alive.current || id !== loopId.current) return;
    const cur = viewRef.current;
    if (cur?.status === "finished" || cur?.status === "aborted") return;
    try {
      const v = await api.interviews.live.get(interviewId, cur ? { rev: cur.rev, online: cur.access?.online ? "1" : "0" } : {});
      if (!alive.current || id !== loopId.current) return;
      if (offlineRef.current) setOff(false);
      if (v) apply(v);
      setLoad((l) => (l.state === "ready" ? l : { state: "ready", message: "" }));
      if (Object.keys(draftsRef.current).length) flush();
      const st = viewRef.current?.status;
      if (st === "finished" || st === "aborted") return; // опрос не нужен
      schedulePoll(POLL_MS, id);
    } catch (e) {
      if (!alive.current || id !== loopId.current) return;
      if (!viewRef.current) {
        setLoad({ state: "error", message: e.status === 404 ? "Сессия не найдена или уже завершена." : (e.message || "") });
        return;
      }
      if (e.status && e.status < 500 && e.status !== 408 && e.status !== 429) {
        setLoad({ state: "error", message: e.message || "" });
        return;
      }
      setOff(true);
      schedulePoll(RETRY_MS, id);
    }
  }

  const start = useCallback(() => {
    loopId.current += 1;
    viewRef.current = null;
    setView(null);
    setLoad({ state: "loading", message: "" });
    tick(loopId.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  useEffect(() => {
    alive.current = true;
    start();
    const timers = noteTimers.current;
    return () => {
      alive.current = false;
      clearTimeout(timerRef.current);
      Object.values(timers).forEach(clearTimeout);
    };
  }, [start]);

  // Оценка: сохраняется сразу; повторный клик по той же оценке снимает её.
  const rate = useCallback((code, patch, { immediate = true } = {}) => {
    const q = viewRef.current?.questions.find((x) => x.code === code);
    if (!q) return;
    setDraftState({ ...draftsRef.current, [code]: { ...draftsRef.current[code], ...patch } });
    clearTimeout(noteTimers.current[code]);
    if (immediate) flush();
    else noteTimers.current[code] = setTimeout(flush, NOTE_DEBOUNCE_MS);
  }, [flush]);

  // Действие с ответом-сессией. Неудача — тост, состояние не меняется.
  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      const v = await fn();
      if (v?.rev !== undefined) apply(v);
      return v;
    } catch (e) {
      if (!e.status || e.status >= 500) setOff(true);
      toast.error(e.message || "Не удалось выполнить действие");
      return null;
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [apply, setOff]);

  const questionAction = useCallback((code, action) => run(() => api.interviews.live.question(interviewId, code, action)), [run, interviewId]);
  const accessAction = useCallback((action, data) => run(() => api.interviews.live.access(interviewId, action, data)), [run, interviewId]);
  const finish = useCallback(async (note) => {
    Object.values(noteTimers.current).forEach(clearTimeout);
    const ok = await flush();
    if (!ok) { toast.error("Оценки ещё не ушли на сервер — проверьте связь"); return null; }
    return run(() => api.interviews.live.finish(interviewId, note ? { note } : {}));
  }, [flush, run, interviewId]);

  return { view, load, offline, drafts, busy, rate, questionAction, accessAction, finish, retry: start };
}
