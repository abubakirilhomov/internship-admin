import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(undefined);
const apiUrl = import.meta.env.VITE_API_URL
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed?.role === 'admin') {
          setUser(parsed);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: trimmedName, lastName: trimmedLastName, password }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { ok: false, error: data.message || 'Ошибка авторизации' };
    }

    if (data.user?.role !== 'admin') {
      return { ok: false, error: 'Доступ только для администраторов' };
    }

    localStorage.setItem('token', data.token);
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return { ok: true };
  } catch (error) {
    console.error('Login error:', error);
    return { ok: false, error: 'Ошибка сети' };
  }
};


  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
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
    localStorage.setItem('token', data.token);
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken);
    }
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