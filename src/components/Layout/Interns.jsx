import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { api } from "../../utils/api";
import InternsTable from "./InternsTable";
import InternsCardList from "./InternsCardList";
import InternFormModal from "./InternFormModal";
import ViolationsModal from "./ViolationsModal";

const Interns = () => {
  const [interns, setInterns] = useState([]);
  const [branches, setBranches] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showFormModal, setShowFormModal] = useState(false);
  const [showViolationsModal, setShowViolationsModal] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState(null);

  useEffect(() => {
    fetchInterns();
    fetchBranches();
    fetchMentors();
    fetchRules();
  }, []);

  const fetchInterns = async () => {
    try {
      setLoading(true);
      const data = await api.interns.getAll();
      setInterns(data);
    } catch (error) {
      setError(error.message || "Ошибка при загрузке интернов");
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await api.branches.getAll();
      setBranches(data);
    } catch (error) {
      setError(error.message || "Ошибка при загрузке филиалов");
    }
  };

  const fetchMentors = async () => {
    try {
      const data = await api.mentors.getAll();
      setMentors(data);
    } catch (error) {
      setError(error.message || "Ошибка при загрузке менторов");
    }
  };

  const fetchRules = async () => {
    try {
      const res = await api.rules.getAll();
      setRules(Array.isArray(res) ? res : res.data || []);
    } catch (error) {
      setError(error.message || "Ошибка при загрузке правил");
    }
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      await api.interns.delete(id);
      await fetchInterns();
    } catch (error) {
      setError(error.message || "Ошибка при удалении стажёра");
      console.error("Error deleting intern:", error);
    } finally {
      setLoading(false);
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
          <button
            className="btn btn-sm btn-circle"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Интерны</h1>
        <button
          className="btn btn-primary gap-2"
          onClick={() => {
            setSelectedIntern(null);
            setShowFormModal(true);
          }}
        >
          <Plus className="h-4 w-4" /> Добавить интерна
        </button>
      </div>

      <InternsTable
        interns={interns}
        branches={branches}
        mentors={mentors}
        rules={rules}
        onEdit={(intern) => {
          setSelectedIntern(intern);
          setShowFormModal(true);
        }}
        onDelete={handleDelete}
        onViolations={(intern) => {
          setSelectedIntern(intern);
          setShowViolationsModal(true);
        }}
        refresh={fetchInterns}
      />

      {/* <InternsCardList
        interns={interns}
        branches={branches}
        mentors={mentors}
        rules={rules}
        onEdit={(intern) => {
          setSelectedIntern(intern);
          setShowFormModal(true);
        }}
        onDelete={handleDelete}
        onViolations={(intern) => {
          setSelectedIntern(intern);
          setShowViolationsModal(true);
        }}
        refresh={fetchInterns}
      /> */}

      {showFormModal && (
        <InternFormModal
          initialData={selectedIntern}
          onClose={() => setShowFormModal(false)}
          refresh={fetchInterns}
          branches={branches}
          mentors={mentors}
          rules={rules}
        />
      )}
      {showViolationsModal && selectedIntern && (
        <ViolationsModal
          intern={selectedIntern}
          rules={rules}
          onClose={() => setShowViolationsModal(false)}
        />
      )}
    </div>
  );
};

export default Interns;