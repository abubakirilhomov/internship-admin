import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Building2, MapPin, Pencil } from 'lucide-react';
import { api } from '../utils/api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Branches = () => {
  const [branches, setBranches] = useState([]);
  const [interns, setInterns] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editBranch, setEditBranch] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
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
      const [branchData, internData, mentorData] = await Promise.all([
        api.branches.getAll(),
        api.interns.getAll(),
        api.mentors.getAll(),
      ]);
      setBranches(branchData);
      setInterns(internData);
      setMentors(mentorData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({ name: '', address: '', city: '' });
    setEditBranch(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editBranch) {
        await api.branches.update(editBranch._id, formData);
      } else {
        await api.branches.create(formData);
      }
      toast.success(editBranch ? 'Филиал обновлён' : 'Филиал создан');
      setEditBranch(null);
      setShowModal(false);
      setFormData({ name: '', address: '', city: '' });
      fetchBranches();
    } catch (error) {
      console.error('Error saving branch:', error);
      toast.error('Произошла ошибка');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.branches.delete(id);
      toast.success('Филиал удалён');
      fetchBranches();
    } catch (error) {
      console.error('Error deleting branch:', error);
      toast.error('Произошла ошибка');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Филиалы</h1>
          <p className="text-slate-500">
            Управление филиалами и отделениями компании
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          onClick={() => setShowModal(true)}
        >
          <Plus className="h-4 w-4" />
          Добавить филиал
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => {
            const internCount = interns.filter(intern =>
              intern.branches?.some(b => String(b.branch?._id || b.branch) === String(branch._id))
            ).length;

            const mentorCount = mentors.filter(mentor =>
              mentor.branches?.some(b => String(b._id || b) === String(branch._id))
            ).length;

            return (
          <div key={branch._id} className="bg-white rounded-2xl shadow p-5">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">{branch.name}</h2>
                  {branch.city && (
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <MapPin className="h-3 w-3" />
                      {branch.city}
                    </div>
                  )}
                </div>
              </div>

              {/* Dropdown menu */}
              <div className="relative group">
                <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
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
                    />
                  </svg>
                </button>
                <div className="absolute right-0 top-8 z-10 hidden group-focus-within:block w-44 bg-white border border-slate-100 rounded-xl shadow-lg py-1">
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      setFormData({
                        name: branch.name,
                        address: branch.address || '',
                        city: branch.city || '',
                      });
                      setEditBranch(branch);
                      setShowModal(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Редактировать
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    onClick={() => setShowDeleteModal(branch._id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </button>
                </div>
              </div>
            </div>

            {branch.address && (
              <p className="text-sm text-slate-500 mt-3">{branch.address}</p>
            )}

            <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
              <div className="text-center">
                <div className="text-lg font-bold text-slate-800">{internCount}</div>
                <div className="text-xs text-slate-400">стажёров</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-800">{mentorCount}</div>
                <div className="text-xs text-slate-400">менторов</div>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <span className="text-xs text-slate-400">
                Создан: {new Date(branch.createdAt).toLocaleDateString('ru-RU')}
              </span>
            </div>
          </div>
            );
          })}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-6">
                {editBranch ? 'Редактировать филиал' : 'Добавить филиал'}
              </h3>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Название
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Город
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Адрес
                  </label>
                  <textarea
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  >
                    {editBranch ? 'Сохранить' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Удалить филиал?</h3>
              <p className="text-sm text-slate-500 mb-6">Это действие нельзя отменить.</p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDelete(showDeleteModal);
                    setShowDeleteModal(null);
                  }}
                  className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl"
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default Branches;
