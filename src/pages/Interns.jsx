import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import { api } from '../utils/api';

const Interns = () => {
  const [interns, setInterns] = useState([]);
  const [branches, setBranches] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = JSON.parse(localStorage.getItem("user"));

  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    username: '',
    password: '',
    branch: '',
    mentor: '',
    feedback: '',
    stars: 0,
    lessonId: '',
    lessonsVisitedCount: '',
    grade: 'junior'
  });

  useEffect(() => {
    fetchInterns();
    fetchBranches();
    fetchMentors();
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

  const fetchInterns = async () => {
    try {
      setLoading(true);
      const data = await api.interns.getAll();
      console.log('Interns data:', data);
      setInterns(data);
    } catch (error) {
      setError(error.message || 'Ошибка при загрузке интернов');
      console.error('Error fetching interns:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await api.branches.getAll();
      setBranches(data);
    } catch (error) {
      setError(error.message || 'Ошибка при загрузке филиалов');
      console.error('Error fetching branches:', error);
    }
  };

  const fetchMentors = async () => {
    try {
      const data = await api.mentors.getAll();
      setMentors(data);
    } catch (error) {
      setError(error.message || 'Ошибка при загрузке менторов');
      console.error('Error fetching mentors:', error);
    }
  };

  const validateForm = () => {
    if (!formData.name) return 'Имя обязательно';
    if (!formData.lastName) return 'Фамилия обязательна';
    if (!formData.username) return 'Имя пользователя обязательно';
    if (!formData.password && !selectedIntern) return 'Пароль обязателен для нового интерна';
    if (formData.password && formData.password.length < 8) return 'Пароль должен содержать минимум 8 символов';
    if (!formData.branch) return 'Выберите филиал';
    if (!formData.mentor) return 'Выберите ментора';
    if (formData.stars < 0 || formData.stars > 5) return 'Рейтинг должен быть от 0 до 5';
    if (formData.lessonId && (!formData.lessonsVisitedCount || formData.lessonsVisitedCount < 0)) {
      return 'Укажите корректное количество уроков';
    }
    if (!['junior', 'middle', 'senior'].includes(formData.grade)) return 'Выберите корректный уровень';
    return null;
  };

  const resetForm = () => {
    setFormData({
      name: '',
      lastName: '',
      username: '',
      password: '',
      branch: '',
      mentor: '',
      feedback: '',
      stars: 0,
      lessonId: '',
      lessonsVisitedCount: '',
      grade: 'junior'
    });
    setError(null);
    setSelectedIntern(null);
    setIsSubmitting(false);
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
      const internData = {
        name: formData.name,
        lastName: formData.lastName,
        username: formData.username,
        ...(formData.password && { password: formData.password }), // Only include password if provided
        branch: formData.branch,
        mentor: formData.mentor,
        grade: formData.grade
      };

      let intern;
      if (selectedIntern) {
        intern = await api.interns.update(selectedIntern._id, internData);
      } else {
        intern = await api.interns.create(internData);
      }

      if (formData.mentor && formData.stars > 0) {
        await api.interns.rate(intern._id, {
          mentorId: formData.mentor,
          stars: formData.stars,
          feedback: formData.feedback || ''
        });
      }

      if (formData.lessonId && formData.lessonsVisitedCount) {
        await api.interns.addLessonVisit(intern._id, {
          mentorId: formData.mentor,
          lessonId: formData.lessonId,
          count: parseInt(formData.lessonsVisitedCount, 10)
        });
      }

      setShowModal(false);
      resetForm();
      fetchInterns();
    } catch (error) {
      setError(error.message || (selectedIntern ? 'Ошибка при обновлении интерна' : 'Ошибка при создании интерна'));
      console.error('Error saving intern:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (intern) => {
    setSelectedIntern(intern);
    const branchId = intern.branch?._id || intern.branch || '';
    const mentorId = intern.mentor?._id || intern.mentor || '';
    setFormData({
      name: intern.name || '',
      lastName: intern.lastName || '',
      username: intern.username || '',
      password: '', // Do not prefill password for security
      branch: branchId,
      mentor: mentorId,
      feedback: intern.feedbacks?.[0]?.feedback || '',
      stars: intern.feedbacks?.[0]?.stars || 0,
      lessonId: '',
      lessonsVisitedCount: '',
      grade: intern.grade || 'junior'
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Вы уверены, что хотите удалить этого интерна?')) {
      try {
        await api.interns.delete(id);
        fetchInterns();
      } catch (error) {
        setError(error.message || 'Ошибка при удалении интерна');
        console.error('Error deleting intern:', error);
      }
    }
  };

  const handleRate = async (id, stars, mentorId = formData.mentor) => {
    if (!mentorId) {
      setError('Выберите ментора для выставления рейтинга');
      return;
    }
    try {
      await api.interns.rate(id, {
        mentorId,
        stars,
        feedback: ''
      });
      fetchInterns();
    } catch (error) {
      setError(error.message || 'Ошибка при выставлении рейтинга');
      console.error('Error rating intern:', error);
    }
  };

  const getBranchName = (branchId) => {
    const branch = branches.find(b => b._id === branchId || b._id === branchId?._id);
    return branch?.name || 'N/A';
  };

  const getMentorName = (mentorId) => {
    const mentor = mentors.find(m => m._id === mentorId || m._id === mentorId?._id);
    return mentor?.name || 'N/A';
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
          <button className="btn btn-sm btn-circle" onClick={() => setError(null)}>✕</button>
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-base-content">Интерны</h1>
        <button className="btn btn-primary gap-2" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="h-4 w-4" /> Добавить интерна
        </button>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="hidden md:block overflow-x-auto">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Фамилия</th>
                  <th>Имя пользователя</th>
                  <th>Филиал</th>
                  <th>Ментор</th>
                  <th>Рейтинг</th>
                  <th>Уроки</th>
                  <th>Уровень</th>
                  <th>Дата создания</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {interns.map((intern) => (
                  <tr key={intern._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar placeholder">
                          <div className="bg-neutral text-neutral-content rounded-full w-8">
                            <span className="text-xs">{intern.name?.charAt(0) || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="font-bold">{intern.name || 'N/A'}</div>
                      </div>
                    </td>
                    <td>{intern.lastName || 'N/A'}</td>
                    <td>{intern.username || 'N/A'}</td>
                    <td>
                      <span className="badge badge-outline">
                        {getBranchName(intern.branch)}
                      </span>
                    </td>
                    <td>{getMentorName(intern.mentor)}</td>
                    <td>
                      <div className="rating rating-sm">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <input
                            key={star}
                            type="radio"
                            name={`rating-${intern._id}`}
                            className="mask mask-star-2 bg-orange-400"
                            checked={(intern.score || 0) >= star}
                            onChange={() => handleRate(intern._id, star, intern.mentor)}
                          />
                        ))}
                      </div>
                    </td>
                    <td>
                      {(intern.lessonsVisited || []).map((lesson) => (
                        <span key={`${lesson.mentorId}-${lesson.lessonId}`} className="badge badge-info mr-1">
                          {getMentorName(lesson.mentorId)} - {lesson.lessonId}: {lesson.count}
                        </span>
                      ))}
                    </td>
                    <td>{intern.grade || 'N/A'}</td>
                    <td>{new Date(intern.createdAt).toLocaleDateString('ru-RU')}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(intern)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDelete(intern._id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden">
            {interns.map((intern) => (
              <div key={intern._id} className="card bg-base-100 shadow mb-4">
                <div className="card-body">
                  <h3 className="font-bold">{intern.name || 'N/A'} {intern.lastName || ''}</h3>
                  <p>Имя пользователя: {intern.username || 'N/A'}</p>
                  <p>Филиал: {getBranchName(intern.branch)}</p>
                  <p>Ментор: {getMentorName(intern.mentor)}</p>
                  <p>Рейтинг: {intern.score || 0}/5</p>
                  <p>Уроки: {(intern.lessonsVisited || [])
                    .map((lesson) => `${getMentorName(lesson.mentorId)} - ${lesson.lessonId}: ${lesson.count}`)
                    .join(', ') || 'N/A'}</p>
                  <p>Уровень: {intern.grade || 'N/A'}</p>
                  <p>Создан: {new Date(intern.createdAt).toLocaleDateString('ru-RU')}</p>
                  <div className="flex gap-2 mt-2">
                    <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(intern)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="btn btn-sm btn-ghost text-error" onClick={() => handleDelete(intern._id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <dialog className={`modal ${showModal ? 'modal-open' : ''}`}>
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">{selectedIntern ? 'Редактировать интерна' : 'Добавить интерна'}</h3>
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
                <span className="label-text">Фамилия</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Имя пользователя</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Пароль {selectedIntern ? '(опционально)' : ''}</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={selectedIntern ? 'Оставьте пустым, чтобы не менять' : 'Введите пароль'}
                required={!selectedIntern}
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
                  <option key={branch._id} value={branch._id}>{branch.name}</option>
                ))}
              </select>
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Ментор</span>
              </label>
              <select
                className="select select-bordered"
                value={formData.mentor}
                onChange={(e) => setFormData({ ...formData, mentor: e.target.value })}
                required
              >
                <option value="">Выберите ментора</option>
                {mentors.map((mentor) => (
                  <option key={mentor._id} value={mentor._id}>{mentor.name}</option>
                ))}
              </select>
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Уровень</span>
              </label>
              <select
                className="select select-bordered"
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
              >
                <option value="junior">Junior</option>
                <option value="middle">Middle</option>
                <option value="senior">Senior</option>
              </select>
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Обратная связь (опционально)</span>
              </label>
              <textarea
                className="textarea textarea-bordered"
                value={formData.feedback}
                onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                placeholder="Введите обратную связь"
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Рейтинг (опционально)</span>
              </label>
              <div className="rating rating-md">
                {[0, 1, 2, 3, 4, 5].map((star) => (
                  <input
                    key={star}
                    type="radio"
                    name="feedback-rating"
                    className="mask mask-star-2 bg-orange-400"
                    checked={formData.stars === star}
                    onChange={() => setFormData({ ...formData, stars: star })}
                  />
                ))}
              </div>
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">ID урока (опционально)</span>
              </label>
              <input
                type="text"
                className="input input-bordered"
                value={formData.lessonId}
                onChange={(e) => setFormData({ ...formData, lessonId: e.target.value })}
                placeholder="Введите ID урока"
              />
            </div>
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Количество посещенных уроков (опционально)</span>
              </label>
              <input
                type="number"
                className="input input-bordered"
                value={formData.lessonsVisitedCount}
                onChange={(e) => setFormData({ ...formData, lessonsVisitedCount: e.target.value })}
                placeholder="Введите количество"
                min="0"
              />
            </div>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => { setShowModal(false); resetForm(); }}>
                Отмена
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Сохранение...' : selectedIntern ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
};

export default Interns;