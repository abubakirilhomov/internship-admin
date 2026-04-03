import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(name, lastName, password);

    if (!success) {
      setError('Неверное имя, фамилия или пароль');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen hero bg-base-200">
      <div className="hero-content flex-col lg:flex-row-reverse">
        <div className="text-center lg:text-left">
          <h1 className="text-5xl font-bold">LMS Admin</h1>
          <p className="py-6">
            Система управления обучением для администраторов и менторов
          </p>
        </div>

        <div className="card shrink-0 w-full max-w-sm shadow-2xl bg-base-100">
          <form className="card-body" onSubmit={handleSubmit}>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Имя</span>
              </label>
              <input
                type="text"
                placeholder="Имя"
                className="input input-bordered"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Фамилия</span>
              </label>
              <input
                type="text"
                placeholder="Фамилия"
                className="input input-bordered"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Пароль</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input input-bordered w-full pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            <div className="form-control mt-6">
              <button
                type="submit"
                className={`btn btn-primary ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {!loading && <LogIn className="h-4 w-4 mr-2" />}
                Войти
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;