import test from "node:test";
import assert from "node:assert/strict";
import {
  fmtClock, fmtDuration, answerStatus, foldSignals, signalLine, signalSummary, signalTone, credentialsText,
  splitBlocks, nextHidden, withDrafts, composition, compositionText, accessState, pluralOpen, windowText,
  overlapText, overlapCellClass, SIZE_OPTIONS, retakeAdvice, RETAKE_GENERATE_GAP,
} from "./liveFormat.js";

test("fmtClock показывает время по Ташкенту (UTC+5)", () => {
  assert.equal(fmtClock("2026-11-27T09:30:00Z"), "14:30");
  assert.equal(fmtClock(null), "");
});

test("fmtDuration", () => {
  assert.equal(fmtDuration(12), "12 с");
  assert.equal(fmtDuration(125), "2 мин");
  assert.equal(fmtDuration(3900), "1 ч 05 мин");
});

test("answerStatus: отправлен / печатает / давний черновик / нет ответа", () => {
  const now = Date.parse("2026-11-27T09:31:00Z");
  assert.equal(answerStatus(null, now).kind, "none");
  assert.deepEqual(answerStatus({ submittedAt: "2026-11-27T09:31:00Z" }, now), { kind: "submitted", text: "Отправлен 14:31" });
  assert.equal(answerStatus({ draftUpdatedAt: "2026-11-27T09:30:57Z" }, now).kind, "typing");
  assert.match(answerStatus({ draftUpdatedAt: "2026-11-27T09:30:57Z" }, now).text, /черновик 3 с назад/);
  assert.equal(answerStatus({ draftUpdatedAt: "2026-11-27T09:20:00Z" }, now).kind, "draft");
  assert.equal(answerStatus({ frozenAt: "2026-11-27T09:20:00Z" }, now).kind, "frozen");
});

test("сигналы: уход и возврат склеиваются, вставка показывает символы", () => {
  const folded = foldSignals([
    { type: "focus_lost", questionCode: "J7", at: "1" },
    { type: "focus_back", questionCode: "J7", at: "2", meta: { ms: 12000 } },
    { type: "paste", questionCode: "J7", at: "3", meta: { chars: 214 } },
    { type: "focus_lost", questionCode: "C6", at: "4" },
  ]);
  assert.equal(folded.length, 3);
  assert.equal(signalLine(folded[0]), "ушёл со вкладки · 12 с");
  assert.equal(signalLine(folded[1]), "вставка · 214 символов");
  assert.equal(signalLine(folded[2]), "ушёл со вкладки");
  assert.equal(signalSummary(folded), "уход 2 · вставка 1");
  assert.match(signalTone(folded[0]), /orange/);
  assert.match(signalTone({ type: "focus_lost", ms: 3000 }), /slate/);
});

test("credentialsText: uz и ru, без протокола в адресе", () => {
  const c = { appUrl: "https://cand.example.app/", username: "aziz-7q4m", password: "5821 9364" };
  assert.equal(credentialsText(c, "uz"), "Sayt: cand.example.app\nLogin: aziz-7q4m\nParol: 5821 9364");
  assert.equal(credentialsText(c, "ru"), "Сайт: cand.example.app\nЛогин: aziz-7q4m\nПароль: 5821 9364");
  assert.equal(credentialsText({ ...c, appUrl: "" }, "uz"), "Login: aziz-7q4m\nParol: 5821 9364");
  assert.equal(windowText({ validFrom: "2026-11-27T08:30:00Z", expiresAt: "2026-11-27T12:00:00Z" }), "13:30–17:00");
});

test("splitBlocks отделяет код от текста", () => {
  const parts = splitBlocks("Что вернёт?\n```js\nfoo()\n```\nПочему?");
  assert.deepEqual(parts.map((p) => p.type), ["text", "code", "text"]);
  assert.equal(parts[1].value, "foo()");
});

test("nextHidden и withDrafts", () => {
  const qs = [
    { code: "A", state: "closed" }, { code: "B", state: "open" }, { code: "C", state: "hidden" }, { code: "D", state: "hidden" },
  ];
  assert.equal(nextHidden(qs, "B").code, "C");
  assert.equal(nextHidden(qs, "D").code, "C");
  assert.equal(nextHidden([{ code: "A", state: "open" }], "A"), null);
  assert.equal(withDrafts({ code: "A", result: null, note: "x" }, { A: { result: "pass" } }).result, "pass");
  assert.equal(withDrafts({ code: "A", result: "fail", note: "x" }, { A: { note: "y" } }).result, "fail");
});

test("composition считает уровни, темы и amaliy", () => {
  const bank = new Map([
    ["H1", { level: "oson", topic: "html" }], ["C2", { level: "orta", topic: "css", isPractical: true }], ["C3", { level: "qiyin", topic: "css" }],
  ]);
  const c = composition(["H1", "C2", "C3", "X9"], bank);
  assert.deepEqual(c.levels, { oson: 1, orta: 1, qiyin: 1 });
  assert.equal(c.known, 3);
  assert.equal(compositionText(c), "HTML 1 · CSS 2 · amaliy 1");
});

test("accessState", () => {
  assert.equal(accessState({ status: "active", online: true }).kind, "online");
  assert.equal(accessState({ status: "active", expired: true }).kind, "expired");
  assert.equal(accessState({ status: "active", lastLoginAt: null }).kind, "never");
  assert.equal(accessState({ status: "active", lastLoginAt: "2026-11-27T09:00:00Z", lastSeenAt: "2026-11-27T09:30:00Z" }, Date.parse("2026-11-27T09:30:40Z")).ago, 40);
  assert.equal(accessState({ status: "revoked" }).kind, "revoked");
});

test("pluralOpen", () => {
  assert.equal(pluralOpen(1), "открытый вопрос");
  assert.equal(pluralOpen(3), "открытых вопроса");
  assert.equal(pluralOpen(5), "открытых вопросов");
  assert.equal(pluralOpen(11), "открытых вопросов");
});

test("overlapText: склонение", () => {
  assert.equal(overlapText(0), "0 пересечений");
  assert.equal(overlapText(1), "1 пересечение");
  assert.equal(overlapText(3), "3 пересечения");
  assert.equal(overlapText(11), "11 пересечений");
  assert.equal(overlapText(22), "22 пересечения");
});

test("overlapCellClass: нет общих — зелёный, мало — жёлтый, много — красный, диагональ — серая", () => {
  assert.match(overlapCellClass(0, 18, 18, false), /green/);
  assert.match(overlapCellClass(2, 18, 18, false), /yellow/);
  assert.match(overlapCellClass(9, 18, 18, false), /red/);
  assert.match(overlapCellClass(18, 18, 18, true), /slate/);
});

test("размеры собеседования 15–20", () => {
  assert.deepEqual(SIZE_OPTIONS, [15, 16, 17, 18, 19, 20]);
});

test("пересдача: генерация по умолчанию, только если она лучше готовых на 3+ пересечения", () => {
  assert.equal(RETAKE_GENERATE_GAP, 3);
  const sets = [{ overlap: 6 }, { overlap: 4 }, { overlap: 9 }];
  const a = retakeAdvice({ retake: true, sets, preview: { overlap: 1 } });
  assert.deepEqual([a.best, a.generated], [4, 1]);
  assert.match(a.text, /1 пересечение с прошлой попыткой, у лучшего готового — 4 пересечения/);
  assert.equal(retakeAdvice({ retake: true, sets, preview: { overlap: 2 } }), null); // разница 2
  assert.equal(retakeAdvice({ retake: false, sets, preview: { overlap: 0 } }), null); // не пересдача
  assert.equal(retakeAdvice({ retake: true, sets, preview: { overlap: 0, violations: ["x"] } }), null); // генерация с нарушением
  assert.equal(retakeAdvice({ retake: true, sets, preview: null }), null);
});
