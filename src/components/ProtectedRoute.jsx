import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// allowReception=true → страница доступна и администратору ресепшена
// (role: 'administrator'). По умолчанию страница только для админов, а
// администратор ресепшена перенаправляется на свою доску бейджиков.
const ProtectedRoute = ({ children, allowReception = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isReceptionOnly =
    user.role === 'administrator' && !(user.isAdmin === true || user.role === 'admin');
  if (isReceptionOnly && !allowReception) {
    return <Navigate to="/badges/reception" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;