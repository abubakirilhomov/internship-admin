// Чистые функции живого собеседования (экран интервьюера и модалки).
// Без React и без браузера — проверяются node --test.

export const TZ = "Asia/Tashkent";

export const LEVELS = {
  oson: { label: "oson", cls: "bg-green-100 text-green-700" },
  orta: { label: "o'rta", cls: "bg-yellow-100 text-yellow-700" },
  qiyin: { label: "qiyin", cls: "bg-red-100 text-red-700" },
};
export const LEVEL_ORDER = ["oson", "orta", "qiyin"];

export const TOPIC_LABELS = {
  html: "HTML", css: "CSS", js: "JavaScript", react: "React", vue: "Vue", tailwind: "Tailwind CSS",
  node: "Node.js", express: "Express", database: "Базы данных", api: "API и HTTP",
};

export const BANK_TRACKS = [
  { value: "frontend-react", label: "React" },
  { value: "frontend-vue", label: "Vue" },
  { value: "backend-nodejs", label: "Backend" },
];
export const TRACK_FULL = {
  "frontend-react": "Frontend (React)",
  "frontend-vue": "Frontend (Vue)",
  "backend-nodejs": "Backend (Node.js)",
};

// Оценки: как MARK_META в ScoringModal.
export const RESULT_META = {
  pass: { label: "✓", cls: "bg-green-500 text-white", idle: "bg-slate-100 text-slate-500 hover:bg-green-100" },
  partial: { label: "½", cls: "bg-amber-400 text-white", idle: "bg-slate-100 text-slate-500 hover:bg-amber-100" },
  fail: { label: "✗", cls: "bg-red-500 text-white", idle: "bg-slate-100 text-slate-500 hover:bg-red-100" },
};
export const RESULT_KEYS = ["pass", "partial", "fail"];

export function fmtClock(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function secondsAgo(value, now = Date.now()) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 1000));
}

// «3 с» / «2 мин» / «1 ч 05 мин»
export function fmtDuration(sec) {
  if (sec == null) return "";
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} мин`;
  return `${Math.floor(m / 60)} ч ${String(m % 60).padStart(2, "0")} мин`;
}

// Состояние ответа кандидата для подписи под полем.
export function answerStatus(answer, now = Date.now()) {
  if (!answer) return { kind: "none", text: "Кандидат ещё ничего не написал" };
  if (answer.submittedAt) return { kind: "submitted", text: `Отправлен ${fmtClock(answer.submittedAt)}` };
  const ago = secondsAgo(answer.draftUpdatedAt, now);
  if (answer.frozenAt) return { kind: "frozen", text: "Вопрос закрыт, ответ не отправлен" };
  if (ago == null) return { kind: "draft", text: "Ещё не отправлен" };
  // «печатает» — черновик обновлялся совсем недавно
  if (ago <= 10) return { kind: "typing", text: `печатает · черновик ${ago} с назад` };
  return { kind: "draft", text: `Ещё не отправлен · черновик ${fmtDuration(ago)} назад` };
}

export function signalText(sig) {
  if (!sig) return "";
  if (sig.type === "paste") return `вставка · ${sig.meta?.chars ?? "?"} символов`;
  if (sig.type === "focus_lost") return "ушёл со вкладки";
  if (sig.type === "focus_back") return "вернулся";
  return sig.type;
}

// Парные focus_lost + focus_back → одна строка «ушёл со вкладки · 12 с».
export function foldSignals(signals = []) {
  const out = [];
  for (const s of signals) {
    if (s.type === "focus_back") {
      const ms = Number(s.meta?.ms);
      // последняя незакрытая «ушёл» получает длительность
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].type === "focus_lost" && out[i].ms == null) {
          if (Number.isFinite(ms)) out[i].ms = ms;
          break;
        }
      }
      continue;
    }
    out.push({ ...s });
  }
  return out;
}

export function signalLine(sig) {
  if (sig.type === "focus_lost") {
    return sig.ms != null ? `ушёл со вкладки · ${fmtDuration(Math.round(sig.ms / 1000))}` : "ушёл со вкладки";
  }
  return signalText(sig);
}

// Подсветка: вставка и долгий уход — оранжевым, короткий уход — серым. Это не обвинение.
export function signalTone(sig) {
  if (sig.type === "paste") return "bg-orange-50 text-orange-700";
  if (sig.type === "focus_lost" && sig.ms != null && sig.ms >= 10000) return "bg-orange-50 text-orange-700";
  return "bg-slate-100 text-slate-600";
}

export function signalSummary(signals = []) {
  const folded = foldSignals(signals);
  const lost = folded.filter((s) => s.type === "focus_lost").length;
  const paste = folded.filter((s) => s.type === "paste").length;
  return `уход ${lost} · вставка ${paste}`;
}

// Чип доступа кандидата в шапке и баннер под ней.
export function accessState(access, now = Date.now()) {
  if (!access) return { kind: "none" };
  if (access.status === "revoked") return { kind: "revoked" };
  if (access.expired) return { kind: "expired" };
  if (access.online) return { kind: "online" };
  if (!access.lastLoginAt) return { kind: "never" };
  const ago = secondsAgo(access.lastSeenAt || access.lastLoginAt, now);
  return { kind: "offline", ago };
}

// Текст для «Скопировать» (кандидату в мессенджер).
export function credentialsText(creds, lang = "uz") {
  if (!creds) return "";
  const site = String(creds.appUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const labels = lang === "ru"
    ? { site: "Сайт", login: "Логин", pass: "Пароль" }
    : { site: "Sayt", login: "Login", pass: "Parol" };
  const lines = [`${labels.login}: ${creds.username}`, `${labels.pass}: ${creds.password}`];
  if (site) lines.unshift(`${labels.site}: ${site}`);
  return lines.join("\n");
}

export function windowText(creds) {
  if (!creds?.validFrom || !creds?.expiresAt) return "";
  return `${fmtClock(creds.validFrom)}–${fmtClock(creds.expiresAt)}`;
}

// Куски текста вопроса: обычный текст и ```код```.
export function splitBlocks(text) {
  const src = String(text || "");
  const parts = [];
  const re = /```[a-zA-Z0-9]*\n?([\s\S]*?)```/g;
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) parts.push({ type: "text", value: src.slice(last, m.index).trim() });
    parts.push({ type: "code", value: m[1].replace(/\n$/, "") });
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ type: "text", value: src.slice(last).trim() });
  return parts.filter((p) => p.value);
}

export function questionText(q, lang) {
  if (!q) return "";
  return (lang === "ru" && q.promptRu) || q.prompt || q.promptRu || "";
}
export function questionShort(q, lang) {
  if (!q) return "";
  return (lang === "ru" && q.promptShortRu) || q.promptShort || q.promptShortRu || q.prompt || "";
}
export function expectedText(q, lang) {
  if (!q) return "";
  return (lang === "ru" && q.expectedAnswerRu) || q.expectedAnswer || q.expectedAnswerRu || "";
}

export function openQuestion(questions = []) {
  return questions.find((q) => q.state === "open") || null;
}

// Следующий скрытый вопрос после code (по порядку набора), иначе первый скрытый.
export function nextHidden(questions = [], code) {
  const idx = questions.findIndex((q) => q.code === code);
  const after = questions.slice(idx + 1).find((q) => q.state === "hidden");
  return after || questions.find((q) => q.state === "hidden" && q.code !== code) || null;
}

// Локальные (ещё не подтверждённые сервером) оценка и заметка поверх серверных.
export function withDrafts(question, drafts = {}) {
  const d = drafts[question.code];
  if (!d) return question;
  return {
    ...question,
    result: d.result !== undefined ? d.result : question.result,
    note: d.note !== undefined ? d.note : question.note,
  };
}

// Состав набора для модалки старта: уровни и темы по карте code → вопрос банка.
export function composition(codes = [], bankByCode = new Map()) {
  const levels = { oson: 0, orta: 0, qiyin: 0 };
  const topics = new Map();
  let practical = 0;
  for (const c of codes) {
    const q = bankByCode.get(c);
    if (!q) continue;
    if (levels[q.level] != null) levels[q.level] += 1;
    topics.set(q.topic, (topics.get(q.topic) || 0) + 1);
    if (q.isPractical) practical += 1;
  }
  return { levels, topics: [...topics.entries()], practical, known: codes.filter((c) => bankByCode.has(c)).length };
}

export function compositionText(comp) {
  const t = comp.topics.map(([topic, n]) => `${TOPIC_LABELS[topic] || topic} ${n}`).join(" · ");
  return comp.practical ? `${t} · amaliy ${comp.practical}` : t;
}

export function fmtShortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(new Date(value));
}

// Текст подтверждения «Завершить».
export function finishSummary(score) {
  if (!score) return { open: 0, text: "" };
  return { open: score.unratedShown || 0, pass: score.passed, pct: score.percentage, earned: score.earned, total: score.total };
}

export function pluralOpen(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "открытый вопрос";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "открытых вопроса";
  return "открытых вопросов";
}

// Размер собеседования: 15–20 вопросов, по умолчанию 18 (его отдаёт сервер).
export const SIZE_OPTIONS = [15, 16, 17, 18, 19, 20];

// «0 пересечений» / «1 пересечение» / «3 пересечения» / «7 пересечений»
export function overlapText(n) {
  const m10 = n % 10, m100 = n % 100;
  let word = "пересечений";
  if (m10 === 1 && m100 !== 11) word = "пересечение";
  else if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) word = "пересечения";
  return `${n} ${word}`;
}

// Цвет ячейки матрицы пересечений: доля общих вопросов от меньшего набора.
// Только палитра админки (green/yellow/red-100, slate).
export function overlapCellClass(n, a, b, isDiagonal) {
  if (isDiagonal) return "bg-slate-100 text-slate-400";
  const base = Math.min(a, b) || 1;
  const share = n / base;
  if (n === 0) return "bg-green-100 text-green-700";
  if (share < 0.25) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}
