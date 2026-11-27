import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const pkgDir = (name) => path.dirname(require.resolve(`${name}/package.json`));
// Библиотеки для живых сцен с demo.runtime (components/questionDemo/runtimes.js):
// файл из node_modules импортируется текстом (?raw) и вставляется в srcdoc сцены.
// Пакеты закрывают umd/ через exports — поэтому путь, а не имя пакета.
const demoRuntime = (name, file) => ({
  find: new RegExp(`^@demo-runtime/${name}(\\?.*)?$`),
  replacement: `${path.join(pkgDir(name), file)}$1`,
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      demoRuntime('react', 'umd/react.production.min.js'),
      demoRuntime('react-dom', 'umd/react-dom.production.min.js'),
      demoRuntime('vue', 'dist/vue.runtime.global.prod.js'),
    ],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
