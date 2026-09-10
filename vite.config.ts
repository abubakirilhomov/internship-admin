import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { execSync } from "node:child_process";

// Версия сборки. Без неё в отчёте об ошибке нельзя сказать, починена она или
// нет: релиз — единственный способ отличить «баг вернулся» от «старый отчёт».
// На хостинге git может быть недоступен, поэтому сначала смотрим переменные,
// которые подставляет платформа.
const release = (() => {
  if (process.env.VITE_RELEASE) return process.env.VITE_RELEASE;
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
})();

const reporterDefine = {
  "import.meta.env.VITE_RELEASE": JSON.stringify(release),
};

// keepNames: без него минификатор переименовывает компоненты на каждой сборке
// (LessonCard → Ac), и серверный fingerprint перестаёт склеивать одну и ту же
// ошибку между релизами — каждый деплой плодил бы новые issue на ровном месте.
const reporterEsbuild = { keepNames: true };


// https://vitejs.dev/config/
export default defineConfig({
  define: reporterDefine,
  esbuild: reporterEsbuild,
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
