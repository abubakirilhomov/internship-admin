import React, { useEffect, useState } from "react";
import { api } from "../utils/api";
import { Loader2 } from "lucide-react";

const InternsRating = () => {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRating = async () => {
      try {
        const data = await api.interns.getRating();
        setInterns(data);
      } catch (err) {
        console.error("Ошибка при загрузке рейтинга:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRating();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="animate-spin w-6 h-6 text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">📊 Рейтинг стажёров</h2>
      <div className="overflow-x-auto">
        <table className="table w-full border">
          <thead className="bg-gray-100">
            <tr>
              <th>#</th>
              <th>Имя</th>
              <th>Филиал</th>
              <th>Ментор</th>
              <th>Оценка</th>
              <th>Посещаемость</th>
              <th>Рейтинг</th>
            </tr>
          </thead>
          <tbody>
            {interns.map((intern, index) => (
              <tr key={intern._id} className="hover:bg-gray-50">
                <td>{index + 1}</td>
                <td>{intern.name}</td>
                <td>{intern.branch?.name || "-"}</td>
                <td>{intern.mentor ? `${intern.mentor.name} ${intern.mentor.lastName}` : "-"}</td>
                <td>{intern.score || 0}</td>
                <td>{intern.attendance}</td>
                <td className="font-bold text-blue-600">{intern.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InternsRating;
