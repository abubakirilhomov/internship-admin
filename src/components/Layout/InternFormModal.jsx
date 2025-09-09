import React, { useState, useEffect } from "react";

const InternFormModal = ({ open, onClose, onSubmit, branches, initialData }) => {
  const [form, setForm] = useState({
    name: "",
    branch: "",
    attendedLessons: 0,
    rating: 0,
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        branch: initialData.branch?._id || "",
        attendedLessons: initialData.attendedLessons || 0,
        rating: initialData.rating || 0,
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <>
      <input type="checkbox" checked={open} readOnly className="modal-toggle" />
      <div className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">
            {initialData ? "Редактировать стажёра" : "Добавить стажёра"}
          </h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Имя"
              className="input input-bordered w-full"
              required
            />

            <select
              name="branch"
              value={form.branch}
              onChange={handleChange}
              className="select select-bordered w-full"
              required
            >
              <option value="">Выбери филиал</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              name="attendedLessons"
              value={form.attendedLessons}
              onChange={handleChange}
              placeholder="Количество уроков"
              className="input input-bordered w-full"
            />

            <input
              type="number"
              name="rating"
              value={form.rating}
              onChange={handleChange}
              min="0"
              max="5"
              placeholder="Рейтинг (0–5)"
              className="input input-bordered w-full"
            />

            <div className="modal-action">
              <button type="button" onClick={onClose} className="btn">
                Отмена
              </button>
              <button type="submit" className="btn btn-success">
                {initialData ? "Сохранить" : "Добавить"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default InternFormModal;
