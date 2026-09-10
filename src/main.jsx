import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { getAuthToken } from './utils/authFetch';
import { initErrorReporter } from './utils/errorReporter';
import './index.css';

// Redux здесь нет: access-токен живёт в модульном состоянии authFetch,
// а пользователь — в localStorage (не credential, кладётся AuthContext).
initErrorReporter({
  app: 'admin',
  endpoint: import.meta.env.VITE_API_URL,
  release: import.meta.env.VITE_RELEASE,
  getToken: () => getAuthToken(),
  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null')?.name || null;
    } catch {
      return null;
    }
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);