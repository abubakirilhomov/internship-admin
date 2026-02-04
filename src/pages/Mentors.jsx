import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, User, Lock, Building, Shield, X, Check } from 'lucide-react';
import { api } from '../utils/api';

const Mentors = () => {
  const [mentors, setMentors] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [resetMentorName, setResetMentorName] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    password: '',
    branch: '',
    role: 'mentor',
  });

  useEffect(() => {
    fetchMentors();
    fetchBranches();
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const fetchMentors = async () => {
    try {
      setLoading(true);
      const data = await api.mentors.getAll();
      setMentors(data);
    } catch (error) {
      setError('Ошибка при загрузке менторов');
      console.error('Error fetching mentors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await api.branches.getAll();
      setBranches(data);
    } catch (error) {
      setError('Ошибка при загрузке филиалов');
      console.error('Error fetching branches:', error);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) errors.name = 'Имя обязательно';
    if (!formData.lastName.trim()) errors.lastName = 'Фамилия обязательна';
    if (!formData.password && !isEditing) errors.password = 'Пароль обязателен';
    if (formData.password && formData.password.length < 6) errors.password = 'Пароль должен содержать не менее 6 символов';
    if (!formData.branch) errors.branch = 'Выберите филиал';
    if (!['mentor', 'admin'].includes(formData.role)) errors.role = 'Неверная роль';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({ name: '', lastName: '', password: '', branch: '', role: 'mentor' });
    setError(null);
    setFieldErrors({});
    setIsEditing(false);
    setEditId(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setTimeout(resetForm, 150); // Wait for modal animation
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await api.mentors.update(editId, formData);
      } else {
        await api.mentors.create(formData);
      }
      closeModal();
      fetchMentors();
    } catch (error) {
      setError(isEditing ? 'Ошибка при обновлении ментора' : 'Ошибка при создании ментора');
      console.error('Error saving mentor:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (mentor) => {
    setFormData({
      name: mentor.name,
      lastName: mentor.lastName || '',
      password: '',
      branch: mentor.branch?._id || mentor.branch || '',
      role: mentor.role || 'mentor',
    });
    setEditId(mentor._id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Вы уверены, что хотите удалить этого ментора?')) {
      try {
        await api.mentors.delete(id);
        fetchMentors();
      } catch (error) {
        setError('Ошибка при удалении ментора');
        console.error('Error deleting mentor:', error);
      }
    }
  };

  const handleResetPassword = async (mentor) => {
    if (confirm(`Вы уверены, что хотите сбросить пароль для ${mentor.name} ${mentor.lastName || ''}?`)) {
      try {
        const result = await api.mentors.resetPassword(mentor._id);
        setTempPassword(result.tempPassword);
        setResetMentorName(`${mentor.name} ${mentor.lastName || ''}`);
        setShowPasswordModal(true);
      } catch (error) {
        setError('Ошибка при сбросе пароля');
        console.error('Error resetting password:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="alert alert-error mb-4">
          {error}
          <button className="btn btn-sm btn-circle" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content mb-2">Менторы</h1>
          <p className="text-base-content opacity-70">
            Управление наставниками и преподавателями
          </p>
        </div>
        <button
          className="btn btn-primary gap-2"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Добавить ментора
        </button>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Фамилия</th>
                  <th>Филиал</th>
                  <th>Роль</th>
                  <th>Дата создания</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {mentors.map((mentor) => (
                  <tr key={mentor._id}>
                    <td>{mentor.name}</td>
                    <td>{mentor.lastName || '-'}</td>
                    <td>
                      {mentor.branch && (
                        <span className="badge badge-outline">
                          {typeof mentor.branch === 'object' ? mentor.branch.name : branches.find(b => b._id === mentor.branch)?.name || 'N/A'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${mentor.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                        {mentor.role}
                      </span>
                    </td>
                    <td>{new Date(mentor.createdAt).toLocaleDateString('ru-RU')}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleEdit(mentor)}
                          title="Редактировать"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="btn btn-sm btn-ghost text-warning"
                          onClick={() => handleResetPassword(mentor)}
                          title="Сбросить пароль"
                        >
                          <Lock className="h-4 w-4" />
                        </button>
                        <button
                          className="btn btn-sm btn-ghost text-error"
                          onClick={() => handleDelete(mentor._id)}
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Enhanced Modal */}
      <dialog className={`modal ${showModal ? 'modal-open' : ''}`}>
        <div className="modal-box w-11/12 max-w-2xl relative">
          {/* Modal Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-base-300">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isEditing ? 'bg-warning/10' : 'bg-primary/10'}`}>
                {isEditing ? (
                  <Pencil className={`h-6 w-6 ${isEditing ? 'text-warning' : 'text-primary'}`} />
                ) : (
                  <User className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-base-content">
                  {isEditing ? 'Редактировать ментора' : 'Добавить ментора'}
                </h3>
                <p className="text-sm text-base-content/60 mt-1">
                  {isEditing ? 'Измените данные ментора' : 'Заполните информацию о новом менторе'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-circle btn-ghost"
              onClick={closeModal}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Error Alert inside Modal */}
          {error && (
            <div className="alert alert-error mb-6">
              <div className="flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Имя
                  </span>
                </label>
                <input
                  type="text"
                  className={`input input-bordered ${fieldErrors.name ? 'input-error' : 'focus:input-primary'}`}
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: null });
                  }}
                  placeholder="Введите имя"
                />
                {fieldErrors.name && (
                  <label className="label">
                    <span className="label-text-alt text-error">{fieldErrors.name}</span>
                  </label>
                )}
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Фамилия
                  </span>
                </label>
                <input
                  type="text"
                  className={`input input-bordered ${fieldErrors.lastName ? 'input-error' : 'focus:input-primary'}`}
                  value={formData.lastName}
                  onChange={(e) => {
                    setFormData({ ...formData, lastName: e.target.value });
                    if (fieldErrors.lastName) setFieldErrors({ ...fieldErrors, lastName: null });
                  }}
                  placeholder="Введите фамилию"
                />
                {fieldErrors.lastName && (
                  <label className="label">
                    <span className="label-text-alt text-error">{fieldErrors.lastName}</span>
                  </label>
                )}
              </div>
            </div>

            {/* Password Field */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Пароль
                  {isEditing && <span className="text-xs text-base-content/60">(необязательно)</span>}
                </span>
              </label>
              <input
                type="password"
                className={`input input-bordered ${fieldErrors.password ? 'input-error' : 'focus:input-primary'}`}
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: null });
                }}
                placeholder={isEditing ? 'Оставьте пустым, чтобы не менять' : 'Введите пароль (мин. 6 символов)'}
              />
              {fieldErrors.password && (
                <label className="label">
                  <span className="label-text-alt text-error">{fieldErrors.password}</span>
                </label>
              )}
              {!isEditing && (
                <label className="label">
                  <span className="label-text-alt">Минимум 6 символов</span>
                </label>
              )}
            </div>

            {/* Branch and Role Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Филиал
                  </span>
                </label>
                <select
                  className={`select select-bordered ${fieldErrors.branch ? 'select-error' : 'focus:select-primary'}`}
                  value={formData.branch}
                  onChange={(e) => {
                    setFormData({ ...formData, branch: e.target.value });
                    if (fieldErrors.branch) setFieldErrors({ ...fieldErrors, branch: null });
                  }}
                >
                  <option value="">Выберите филиал</option>
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.branch && (
                  <label className="label">
                    <span className="label-text-alt text-error">{fieldErrors.branch}</span>
                  </label>
                )}
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Роль
                  </span>
                </label>
                <select
                  className={`select select-bordered ${fieldErrors.role ? 'select-error' : 'focus:select-primary'}`}
                  value={formData.role}
                  onChange={(e) => {
                    setFormData({ ...formData, role: e.target.value });
                    if (fieldErrors.role) setFieldErrors({ ...fieldErrors, role: null });
                  }}
                >
                  <option value="mentor">Ментор</option>
                  <option value="admin">Администратор</option>
                </select>
                {fieldErrors.role && (
                  <label className="label">
                    <span className="label-text-alt text-error">{fieldErrors.role}</span>
                  </label>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-base-300">
              <button
                type="button"
                className="btn btn-outline"
                onClick={closeModal}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
                Отмена
              </button>
              <button
                type="submit"
                className={`btn ${isEditing ? 'btn-warning' : 'btn-primary'} min-w-[120px]`}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {isEditing ? 'Обновить' : 'Создать'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={closeModal}>close</button>
        </form>
      </dialog>

      {/* Password Reset Success Modal */}
      <dialog className={`modal ${showPasswordModal ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-success/10">
              <Lock className="h-6 w-6 text-success" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-base-content">Пароль сброшен</h3>
              <p className="text-sm text-base-content/60 mt-1">
                Новый временный пароль для {resetMentorName}
              </p>
            </div>
          </div>

          <div className="alert alert-warning mb-4">
            <div className="flex flex-col gap-2 w-full">
              <span className="font-semibold">⚠️ Важно: Сохраните этот пароль!</span>
              <span className="text-sm">Этот пароль больше не будет показан. Передайте его ментору безопасным способом.</span>
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Временный пароль:</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input input-bordered flex-1 font-mono text-lg"
                value={tempPassword}
                readOnly
              />
              <button
                className="btn btn-square"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  // Could add a toast notification here
                }}
                title="Копировать"
              >
                📋
              </button>
            </div>
          </div>

          <div className="modal-action">
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowPasswordModal(false);
                setTempPassword('');
                setResetMentorName('');
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => {
            setShowPasswordModal(false);
            setTempPassword('');
            setResetMentorName('');
          }}>close</button>
        </form>
      </dialog>
    </div>
  );
};

export default Mentors;