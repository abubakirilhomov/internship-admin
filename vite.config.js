import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    // jsdom, а не node: тестируем компоненты и код, который лезет в
    // localStorage, fetch и window.
    environment: 'jsdom',
    // globals: describe/it/expect без импорта — так же, как в jest на бэкенде,
    // чтобы переключение между репозиториями не требовало смены привычек.
    globals: true,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    // Моки не протекают между тестами.
    restoreMocks: true,
    clearMocks: true,
    // Модули читают import.meta.env на загрузке; без этого базовый URL был бы
    // строкой "undefined" и тесты проверяли бы не то, что работает в проде.
    env: { VITE_API_URL: 'http://api.test/api' },
  },
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});