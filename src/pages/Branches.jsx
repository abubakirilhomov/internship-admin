import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Building2, MapPin } from 'lucide-react';
import { api } from '../utils/api';

const Branches = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      const data = await api.branches.getAll();
      setBranches(data);
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.branches.create(formData);
      setShowModal(false);
      setFormData({ name: '', address: '', city: '' });
      fetchBranches();
    } catch (error) {
      console.error('Error creating branch:', error);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Вы уверены, что хотите удалить этот филиал?')) {
      try {
        await api.branches.delete(id);
        fetchBranches();
      } catch (error) {
        console.error('Error deleting branch:', error);
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-base-content mb-2">Филиалы</h1>
          <p className="text-base-content opacity-70">
            Управление филиалами и отделениями компании
          </p>
        </div>
        <button
          className="btn btn-primary gap-2"
          onClick={() => setShowModal(true)}
        >
          <Plus className="h-4 w-4" />
          Добавить филиал
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => (
          <div key={branch._id} className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="avatar text-center placeholder">
                    <div className="bg-accent text-center flex items-center justify-center w-full text-accent-content rounded-full p-5">
                      <Building2 className="h-6 w-6" />
                    </div>
                  </div>
                  <div>
                    <h2 className="card-title">{branch.name}</h2>
                    {branch.city && (
                      <div className="flex items-center gap-1 text-sm opacity-70">
                        <MapPin className="h-3 w-3" />
                        {branch.city}
                      </div>
                    )}
                  </div>
                </div>
                <div className="dropdown dropdown-end">
                  <div tabIndex={0} role="button" className="btn btn-ghost btn-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      className="inline-block w-5 h-5 stroke-current"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
                      ></path>
                    </svg>
                  </div>
                  <ul
                    tabIndex={0}
                    className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
                  >
                    <li>
                      <button
                        className="text-error"
                        onClick={() => handleDelete(branch._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Удалить
                      </button>
                    </li>
                  </ul>
                </div>
              </div>

              {branch.address && (
                <p className="text-sm opacity-70 mt-2">{branch.address}</p>
              )}

              <div className="card-actions justify-end mt-4">
                <span className="text-xs opacity-50">
                  Создан: {new Date(branch.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <dialog className={`modal ${showModal ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">Добавить филиал</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Название</span>
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
                <span className="label-text">Город</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Адрес</span>
              </label>
              <textarea
                className="textarea textarea-bordered"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowModal(false);
                  setFormData({ name: '', address: '', city: '' });
                }}
              >
                Отмена
              </button>
              <button type="submit" className="btn btn-primary">
                Создать
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
};

export default Branches;