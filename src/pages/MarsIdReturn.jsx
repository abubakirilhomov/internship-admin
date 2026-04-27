import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const API_URL = import.meta.env.VITE_API_URL;

const parseFragment = () => {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
};

const MarsIdReturn = () => {
  const { user, setSession } = useAuth();
  const [linkage, setLinkage] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fragment = useMemo(() => parseFragment(), []);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (fragment.marsIdError) {
      setError(decodeURIComponent(fragment.marsIdError));
      return;
    }
    if (fragment.token && fragment.user) {
      try {
        const parsedUser = JSON.parse(fragment.user);
        const result = setSession({
          token: fragment.token,
          refreshToken: fragment.refreshToken,
          user: parsedUser,
        });
        if (!result.ok) setError(result.error);
      } catch {
        setError("Не удалось разобрать ответ Mars ID");
      }
      return;
    }
    if (fragment.linkageToken) {
      setLinkage({
        token: fragment.linkageToken,
        handle: fragment.handle || "",
        kind: fragment.kind || "mentor",
      });
      return;
    }
    setError("Mars ID не вернул ни сессию, ни запрос на привязку");
  }, [fragment, setSession]);

  const handleLink = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/auth/marsid/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkageToken: linkage.token,
          username: `${name.trim()} ${lastName.trim()}`.trim(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Не удалось привязать Mars ID");
        return;
      }
      const result = setSession(data);
      if (!result.ok) setError(result.error);
    } catch {
      setError("Ошибка сети при привязке");
    } finally {
      setSubmitting(false);
    }
  };

  if (user) return <Navigate to="/dashboard" replace />;

  if (linkage) {
    return (
      <div className="min-h-screen hero bg-base-200">
        <div className="card shrink-0 w-full max-w-sm shadow-2xl bg-base-100">
          <form className="card-body" onSubmit={handleLink}>
            <h2 className="text-xl font-bold text-center mb-2">Привяжите Mars ID</h2>
            <p className="text-center text-sm text-base-content/70 mb-2">
              Mars ID {linkage.handle && <strong>@{linkage.handle}</strong>} ещё не привязан к
              вашему аккаунту администратора. Введите имя, фамилию и текущий пароль.
            </p>
            <div className="form-control">
              <label className="label"><span className="label-text">Имя</span></label>
              <input className="input input-bordered" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Фамилия</span></label>
              <input className="input input-bordered" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Пароль</span></label>
              <input type="password" className="input input-bordered" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <div className="alert alert-error mt-2"><span>{error}</span></div>}
            <div className="form-control mt-4">
              <button type="submit" className={`btn btn-primary ${submitting ? "loading" : ""}`} disabled={submitting}>
                Привязать и войти
              </button>
            </div>
            <Link to="/login" className="btn btn-ghost btn-sm">Отмена</Link>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero bg-base-200">
      <div className="card shrink-0 w-full max-w-sm shadow-2xl bg-base-100">
        <div className="card-body items-center text-center">
          {error ? (
            <>
              <h2 className="text-xl font-bold">Ошибка Mars ID</h2>
              <p className="text-sm text-base-content/70">{error}</p>
              <Link to="/login" className="btn btn-primary mt-4">Вернуться ко входу</Link>
            </>
          ) : (
            <p>Завершаем вход через Mars ID…</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarsIdReturn;
