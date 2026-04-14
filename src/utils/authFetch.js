// fetch wrapper with automatic access-token refresh on 401.
// Uses localStorage keys `token` and `refreshToken`. On refresh failure,
// clears credentials and hard-redirects to /login so AuthContext re-inits.

const API_BASE_URL = import.meta.env.VITE_API_URL;

let isRefreshing = false;
let waiters = [];

const notifyWaiters = (newToken) => {
  waiters.forEach((cb) => cb(newToken));
  waiters = [];
};

const clearSessionAndRedirect = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
};

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/mentors/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.token) return null;
    localStorage.setItem("token", data.token);
    return data.token;
  } catch {
    return null;
  }
};

const buildHeaders = (extra = {}) => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...extra,
  };
};

/**
 * Authenticated fetch.
 * - Inject Authorization header from localStorage.
 * - On 401, try refresh once, then retry the original request with the new token.
 * - Concurrent 401s queue on a single refresh.
 */
const stripAuth = (headers = {}) => {
  // Remove any pre-baked Authorization header from caller so authFetch
  // can re-inject the fresh token on retry after a refresh.
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() !== "authorization") out[k] = v;
  }
  return out;
};

export const authFetch = async (path, init = {}) => {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const attempt = async () => {
    const cleanInitHeaders = stripAuth(init.headers);
    const token = localStorage.getItem("token");
    const headers =
      init.body instanceof FormData
        ? {
            ...(token && { Authorization: `Bearer ${token}` }),
            ...cleanInitHeaders,
          }
        : buildHeaders(cleanInitHeaders);
    return fetch(url, { ...init, headers });
  };

  let response = await attempt();

  if (response.status !== 401) return response;

  // 401: try to refresh
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
