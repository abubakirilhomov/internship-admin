import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
  const [formData, setFormData] = useState({
    name: '',
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
        setShowModal(false);
        resetForm();
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
    if (!formData.name) return 'Имя обязательно';
    if (!formData.password || formData.password.length < 6) return 'Пароль должен содержать не менее 6 символов';
    if (!formData.branch) return 'Выберите филиал';
    if (!['mentor', 'admin'].includes(formData.role)) return 'Неверная роль';
    return null;
  };

  const resetForm = () => {
    setFormData({ name: '', password: '', branch: '', role: 'mentor' });
    setError(null);
    setIsEditing(false);
    setEditId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await api.mentors.update(editId, formData);
      } else {
        await api.mentors.create(formData);
      }
      setShowModal(false);
      resetForm();
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
                  <th>Филиал</th>
                  <th>Роль</th>
                  <th>Дата создания</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {mentors.map((mentor) => (
                  <tr key={mentor._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar text-center placeholder">
                          <div className="bg-secondary text-secondary-content rounded-full w-8">
                            <span className="text-xs">{mentor.name.charAt(0)}</span>
                          </div>
                        </div>
                        <div className="font-bold">{mentor.name}</div>
                      </div>
                    </td>
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
                    <td>
                      {new Date(mentor.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleEdit(mentor)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="btn btn-sm btn-ghost text-error"
                          onClick={() => handleDelete(mentor._id)}
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

      <dialog className={`modal ${showModal ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">{isEditing ? 'Редактировать ментора' : 'Добавить ментора'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Имя</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Пароль</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={isEditing ? 'Оставьте пустым, чтобы не менять' : ''}
                required={!isEditing}
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Филиал</span>
              </label>
              <select
                className="select select-bordered"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                required
              >
                <option value="">Выберите филиал</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Роль</span>
              </label>
              <select
                className="select select-bordered"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                required
              >
                <option value="mentor">Ментор</option>
                <option value="admin">Админ</option>
              </select>
            </div>
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Сохранение...' : isEditing ? 'Обновить' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
};

export default Mentors;