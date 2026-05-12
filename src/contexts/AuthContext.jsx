import React, { createContext, useContext, useState, useEffect } from 'react';
import { setAuthToken } from '../utils/authFetch';

const AuthContext = createContext(undefined);
const apiUrl = import.meta.env.VITE_API_URL;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Access token lives only in module state (via setAuthToken) + this provider's
// closure. Refresh token rides the httpOnly cookie set by the server. We keep
// `user` in localStorage for snappy boot UX — it's not a credential.
const readCachedUser = () => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.role === 'admin' ? parsed : null;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readCachedUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cold boot: try to mint an access token from the refresh cookie. If the
    // server says no, clear any cached user and land the admin on /login.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/mentors/refresh-token`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.token) {
            setAuthToken(data.token);
            setLoading(false);
            return;
          }
        }
        // Refresh failed: clear cached user, stay logged out.
        localStorage.removeItem('user');
        setAuthToken(null);
        setUser(null);
      } catch {
        if (!cancelled) {
          localStorage.removeItem('user');
          setAuthToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (name, lastName, password) => {
    const trimmedName = String(name || '').trim();
    const trimmedLastName = String(lastName || '').trim();

    if (!trimmedName || !trimmedLastName || !password) {
      return { ok: false, error: 'Заполните имя, фамилию и пароль' };
    }

    try {
      const response = await fetch(`${apiUrl}/mentors/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, lastName: trimmedLastName, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { ok: false, error: data.message || 'Ошибка авторизации' };
      }

      if (data.user?.role !== 'admin') {
        return { ok: false, error: 'Доступ только для администраторов' };
      }

      setAuthToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: 'Ошибка сети' };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${apiUrl}/mentors/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
    } catch {
      // Server may be unreachable — proceed to clear local state anyway.
    }
    localStorage.removeItem('user');
    setAuthToken(null);
    setUser(null);
  };

  // Save a session built externally (e.g. Mars ID OIDC return).
  // Enforces admin-only role for this app.
  const setSession = (data) => {
    if (!data?.token || !data?.user) {
      return { ok: false, error: 'Некорректный ответ авторизации' };
    }
    if (data.user.role !== 'admin') {
      return { ok: false, error: 'Доступ только для администраторов' };
    }
    setAuthToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return { ok: true };
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, setSession }}>
      {children}
    </AuthContext.Provider>
  );
};
