// node --test: ядро песочницы одинаково у кандидата (candidates/src/lib/sandbox) и у
// интервьюера (internship-admin/src/components/codeSandbox) — иначе интервьюер увидит
// не тот результат, что кандидат. Правите файлы — скопируйте их во второй репозиторий
// и обновите хеш в ОБОИХ sync.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const FILES = ["runner.js", "prelude.js", "protectLoops.js", "runnable.js", "sandpack.js"];
const SANDBOX_CORE_HASH = "91877f7d24df93c8";

test("ядро песочницы совпадает с копией во втором репозитории", () => {
  const h = createHash("sha256");
  for (const f of FILES) h.update(fs.readFileSync(new URL(f, import.meta.url)));
  assert.equal(h.digest("hex").slice(0, 16), SANDBOX_CORE_HASH);
});
