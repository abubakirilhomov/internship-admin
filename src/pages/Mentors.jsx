import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, User, Lock, Building, Shield, X, Check, Image } from 'lucide-react';
import { api } from '../utils/api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    password: '',
    profilePhoto: '',
    branches: [],
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
    if (!formData.branches.length) errors.branches = 'Выберите хотя бы один филиал';
    if (!['mentor', 'admin', 'branchManager'].includes(formData.role)) errors.role = 'Неверная роль';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setFormData({ name: '', lastName: '', password: '', profilePhoto: '', branches: [], role: 'mentor' });
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
        toast.success('Ментор обновлён');
      } else {
        await api.mentors.create(formData);
        toast.success('Ментор создан');
      }
      closeModal();
      fetchMentors();
    } catch (error) {
      toast.error(error.message || 'Произошла ошибка');
      console.error('Error saving mentor:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (mentor) => {
    const branchIds = (mentor.branches || []).map((b) =>
      typeof b === 'object' ? b._id : b
    );
    setFormData({
      name: mentor.name,
      lastName: mentor.lastName || '',
      password: '',
      profilePhoto: mentor.profilePhoto || '',
      branches: branchIds,
      role: mentor.role || 'mentor',
    });
    setEditId(mentor._id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.mentors.delete(id);
      setShowDeleteModal(null);
      fetchMentors();
      toast.success('Ментор удалён');
    } catch (error) {
      toast.error(error.message || 'Произошла ошибка');
    }
  };

  const confirmResetPassword = async () => {
    const mentor = showResetConfirmModal;
    try {
      const result = await api.mentors.resetPassword(mentor._id);
      setTempPassword(result.tempPassword);
      setResetMentorName(`${mentor.name} ${mentor.lastName || ''}`);
      setShowResetConfirmModal(null);
      setShowPasswordModal(true);
      toast.success('Пароль сброшен');
    } catch (error) {
      toast.error(error.message || 'Произошла ошибка');
      setShowResetConfirmModal(null);
    }
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    try {
      setUploadingPhoto(true);
      const uploaded = await api.uploads.uploadImage(file, 'mentors');
      setFormData((prev) => ({ ...prev, profilePhoto: uploaded.url }));
    } catch (uploadError) {
      setError(uploadError.message || 'Ошибка загрузки фото');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const filteredMentors = mentors.filter(m => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.lastName?.toLowerCase().includes(q)
    );
  });

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

      <div className="mb-4 flex items-center gap-2 max-w-sm">
        <input
          type="text"
          placeholder="Поиск по имени..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 text-sm px-2">✕</button>
        )}
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
                  <th>Фото</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredMentors.map((mentor) => (
                  <tr key={mentor._id}>
                    <td>{mentor.name}</td>
                    <td>{mentor.lastName || '-'}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(mentor.branches || []).map((b, i) => (
                          <span key={i} className="badge badge-outline">
                            {typeof b === 'object' ? b.name : branches.find((br) => br._id === b)?.name || 'N/A'}
                          </span>
                        ))}
                        {!mentor.branches?.length && <span className="text-base-content/40">—</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${mentor.role === 'admin' ? 'badge-primary' : 'badge-secondary'}`}>
                        {mentor.role}
                      </span>
                    </td>
                    <td>{new Date(mentor.createdAt).toLocaleDateString('ru-RU')}</td>
                    <td>
                      {mentor.profilePhoto ? (
                        <img src={mentor.profilePhoto} alt={mentor.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <span className="text-base-content/40">—</span>
                      )}
                    </td>
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
                          onClick={() => setShowResetConfirmModal(mentor)}
                          title="Сбросить пароль"
                        >
                          <Lock className="h-4 w-4" />
                        </button>
                        <button
                          className="btn btn-sm btn-ghost text-error"
                          onClick={() => setShowDeleteModal(mentor)}
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMentors.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 text-sm">
                      {searchTerm ? 'Ничего не найдено' : 'Нет менторов'}
                    </td>
                  </tr>
                )}
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

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Фото профиля
                </span>
              </label>
              <input
                type="file"
                accept="image/*"
                className="file-input file-input-bordered w-full"
                onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                disabled={uploadingPhoto}
              />
              <input
                type="text"
                className="input input-bordered focus:input-primary mt-2"
                value={formData.profilePhoto}
                onChange={(e) => setFormData({ ...formData, profilePhoto: e.target.value })}
                placeholder="URL фото появится после загрузки"
              />
              {uploadingPhoto && <span className="text-xs text-info mt-1">Загрузка фото...</span>}
              {formData.profilePhoto && (
                <img src={formData.profilePhoto} alt="preview" className="w-14 h-14 rounded-full object-cover mt-2 border" />
              )}
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
                    Филиалы
                  </span>
                </label>
                <select
                  multiple
                  className={`select select-bordered h-28 ${fieldErrors.branches ? 'select-error' : 'focus:select-primary'}`}
                  value={formData.branches}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setFormData({ ...formData, branches: selected });
                    if (fieldErrors.branches) setFieldErrors({ ...fieldErrors, branches: null });
                  }}
                >
                  {branches.map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                <label className="label">
                  <span className="label-text-alt text-base-content/50">Ctrl+click для выбора нескольких</span>
                </label>
                {fieldErrors.branches && (
                  <label className="label">
                    <span className="label-text-alt text-error">{fieldErrors.branches}</span>
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
                  <option value="branchManager">Branch manager</option>
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

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">Удалить ментора?</h3>
            <p className="text-sm text-slate-500 mb-6">
              <strong>{showDeleteModal.name} {showDeleteModal.lastName || ''}</strong> будет удалён без возможности восстановления.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(null)} className="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Отмена</button>
              <button onClick={() => handleDelete(showDeleteModal._id)} className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors">Удалить</button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowResetConfirmModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-1">Сбросить пароль?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Будет создан временный пароль для <strong>{showResetConfirmModal.name} {showResetConfirmModal.lastName || ''}</strong>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirmModal(null)} className="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Отмена</button>
              <button onClick={confirmResetPassword} className="flex-1 px-4 py-2.5 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors">Сбросить</button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Mentors;
