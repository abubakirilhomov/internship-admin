import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_TRACKS, SPHERE_LABELS, trackLabel, sphereToTrack, trackOptions, topicLabel, sortTopics, pyModule, TOPIC_LABELS, pendingLabel,
} from "./tracks.js";

test("направления: в выборе ровно три (JS · React, JS · Vue, Python), backend-nodejs — архив", () => {
  assert.deepEqual(ACTIVE_TRACKS.map((t) => [t.value, t.label]), [
    ["frontend-react", "JS · React"], ["frontend-vue", "JS · Vue"], ["backend-python", "Python"],
  ]);
  assert.equal(trackLabel("backend-nodejs"), "Backend (Node.js) — архив");
  assert.equal(trackLabel("backend-python"), "Python");
  assert.equal(SPHERE_LABELS["mern-stack"], "React + Python");
  assert.equal(SPHERE_LABELS["full-stack"], "React + Node");
  assert.equal(trackLabel("unknown-x"), "unknown-x");
  assert.equal(trackLabel(""), "—");
});

test("sphereToTrack: vue/python/node сохраняются, прочее → JS · React", () => {
  assert.equal(sphereToTrack("frontend-vue"), "frontend-vue");
  assert.equal(sphereToTrack("backend-python"), "backend-python");
  assert.equal(sphereToTrack("backend-nodejs"), "backend-nodejs");
  assert.equal(sphereToTrack("frontend-react"), "frontend-react");
  assert.equal(sphereToTrack("mern-stack"), "frontend-react");
  assert.equal(sphereToTrack("full-stack"), "frontend-react");
  assert.equal(sphereToTrack(undefined), "frontend-react");
});

test("trackOptions: архивный трек — только если уже выбран", () => {
  assert.deepEqual(trackOptions([]).map((t) => t.value), ["frontend-react", "frontend-vue", "backend-python"]);
  assert.deepEqual(trackOptions(["frontend-react"]).map((t) => t.value), ["frontend-react", "frontend-vue", "backend-python"]);
  assert.deepEqual(trackOptions("backend-nodejs").map((t) => t.value), ["frontend-react", "frontend-vue", "backend-python", "backend-nodejs"]);
});

test("порядок тем: JS как в банке, затем модули Python по номеру (py-m10 после py-m9)", () => {
  const shuffled = ["py-m10", "css", "py-m3", "zzz", "py-m11", "html", "py-m9", "react", "py-m4"];
  assert.deepEqual(sortTopics(shuffled), ["html", "css", "react", "py-m3", "py-m4", "py-m9", "py-m10", "py-m11", "zzz"]);
  assert.equal(pyModule("py-m10"), 10);
  assert.equal(pyModule("js"), null);
});

test("подписи тем: с бэка для модулей Python, иначе запасная карта; JS-темы — русские", () => {
  assert.equal(topicLabel("py-m3"), "M3 · Python asoslari");
  assert.equal(topicLabel("py-m10"), TOPIC_LABELS["py-m10"]);
  assert.equal(topicLabel("py-m5", { "py-m5": { uz: "M5 · Sintetik", ru: "M5 · Синтетика" } }), "M5 · Sintetik");
  assert.equal(topicLabel("database", { database: { uz: "Boshqa", ru: "Другое" } }), "Базы данных");
  assert.equal(topicLabel("new-topic", { "new-topic": { ru: "Новая" } }), "Новая");
  assert.equal(topicLabel("nope"), "nope");
});

test("неактивный «ждёт включения»: у модулей Python — «ещё не пройдено», у Node — «не включён»", () => {
  assert.equal(pendingLabel("py-m5").badge, "ещё не пройдено");
  assert.equal(pendingLabel("node").badge, "не включён");
  assert.equal(pendingLabel("node").action, "Включить");
});
