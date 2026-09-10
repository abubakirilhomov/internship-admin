// fetch wrapper with automatic access-token refresh on 401.
// Access token lives in module-level state (set by AuthContext.login /
// refresh / setSession). Refresh token rides the httpOnly cookie set by
// the backend; we never see it from JS.

import { reportApiFailure, apiBreadcrumb } from "./errorReporter";

const API_BASE_URL = import.meta.env.VITE_API_URL;

let accessToken = null;
let isRefreshing = false;
let waiters = [];

export const setAuthToken = (token) => {
  accessToken = token;
};

export const getAuthToken = () => accessToken;

const notifyWaiters = (newToken) => {
  waiters.forEach((cb) => cb(newToken));
  waiters = [];
};

const clearSessionAndRedirect = () => {
  accessToken = null;
  localStorage.removeItem("user");
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

const refreshAccessToken = async () => {
  // Migration shim: pre-cutover sessions still have refreshToken in
  // localStorage. Pass as body fallback once; backend rotates to cookie.
  const legacy = localStorage.getItem("refreshToken");
  try {
    const res = await fetch(`${API_BASE_URL}/mentors/refresh-token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(legacy ? { refreshToken: legacy } : {}),
    });
    if (legacy) {
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("token");
    }
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.token) return null;
    accessToken = data.token;
    return data.token;
  } catch {
    if (legacy) {
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("token");
    }
    return null;
  }
};

const buildHeaders = (extra = {}) => ({
  "Content-Type": "application/json",
  ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
  ...extra,
});

const stripAuth = (headers = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== "authorization") out[k] = v;
  }
  return out;
};

const authFetchInner = async (path, init = {}) => {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const attempt = async () => {
    const cleanInitHeaders = stripAuth(init.headers);
    const headers =
      init.body instanceof FormData
        ? {
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            ...cleanInitHeaders,
          }
        : buildHeaders(cleanInitHeaders);
    return fetch(url, { ...init, credentials: "include", headers });
  };

  let response = await attempt();

  if (response.status !== 401) return response;

  if (isRefreshing) {
    const newToken = await new Promise((resolve) => waiters.push(resolve));
    if (!newToken) return response;
    return attempt();
  }

  isRefreshing = true;
  const newToken = await refreshAccessToken();
  isRefreshing = false;
  notifyWaiters(newToken);

  if (!newToken) {
    clearSessionAndRedirect();
    return response;
  }

  return attempt();
};

/**
 * Обёртка с телеметрией поверх authFetchInner.
 *
 * Крошка на каждый вызов — контекст для будущей ошибки. В отчёт только 5xx и
 * обрывы сети: 4xx уже в серверном аудит-логе, а 401 здесь штатный — его
 * перехватывает и чинит обновление токена выше.
 */
export const authFetch = async (path, init = {}) => {
  const started = Date.now();
  const method = String(init.method || "GET").toUpperCase();
  try {
    const response = await authFetchInner(path, init);
    apiBreadcrumb({ method, url: path, status: response.status, ms: Date.now() - started });
    if (response.status >= 500) reportApiFailure({ method, url: path, status: response.status });
    return response;
  } catch (error) {
    apiBreadcrumb({ method, url: path, status: null, ms: Date.now() - started });
    reportApiFailure({ method, url: path, error });
    throw error;
  }
};
