import React, { useState, useEffect } from "react";
import { api } from "../utils/api";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const ViolationsPage = () => {
    const [violations, setViolations] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        branch: "all",
        category: "all",
        startDate: null,
        endDate: null
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const branchesData = await api.branches.getAll();
                setBranches(branchesData);
            } catch (error) {
                console.error("Failed to load branches", error);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchViolations();
    }, [filters]);

    const fetchViolations = async () => {
        setLoading(true);
        try {
            const params = {
                branch: filters.branch,
                category: filters.category,
            };
            if (filters.startDate) params.startDate = filters.startDate.toISOString();
            if (filters.endDate) params.endDate = filters.endDate.toISOString();

            const data = await api.violations.getAll(params);
            setViolations(data);
        } catch (error) {
            console.error("Failed to load violations", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const getCategoryBadge = (category) => {
        switch (category) {
            case "red": return "badge-error text-white";
            case "yellow": return "badge-warning text-black";
            case "green": return "badge-success text-white";
            case "black": return "bg-gray-800 text-white";
            default: return "badge-ghost";
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Нарушения</h1>

            {/* Filters */}
            <div className="bg-base-100 p-4 rounded-lg shadow mb-6 flex flex-wrap gap-4 items-end">
                <div className="form-control">
                    <label className="label"><span className="label-text">Филиал</span></label>
                    <select
                        className="select select-bordered w-full max-w-xs"
                        value={filters.branch}
                        onChange={(e) => handleFilterChange("branch", e.target.value)}
                    >
                        <option value="all">Все филиалы</option>
                        {branches.map(b => (
                            <option key={b._id} value={b._id}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-control">
                    <label className="label"><span className="label-text">Категория</span></label>
                    <select
                        className="select select-bordered w-full max-w-xs"
                        value={filters.category}
                        onChange={(e) => handleFilterChange("category", e.target.value)}
                    >
                        <option value="all">Все категории</option>
                        <option value="red">Красные</option>
                        <option value="yellow">Желтые</option>
                        <option value="green">Зеленые</option>
                        <option value="black">Черные</option>
                    </select>
                </div>

                <div className="form-control">
                    <label className="label"><span className="label-text">Дата с</span></label>
                    <DatePicker
                        selected={filters.startDate}
                        onChange={(date) => handleFilterChange("startDate", date)}
                        selectsStart
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                        className="input input-bordered w-full max-w-xs"
                        dateFormat="dd.MM.yyyy"
                    />
                </div>

                <div className="form-control">
                    <label className="label"><span className="label-text">Дата по</span></label>
                    <DatePicker
                        selected={filters.endDate}
                        onChange={(date) => handleFilterChange("endDate", date)}
                        selectsEnd
                        startDate={filters.startDate}
                        endDate={filters.endDate}
                        minDate={filters.startDate}
                        className="input input-bordered w-full max-w-xs"
                        dateFormat="dd.MM.yyyy"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
                <table className="table table-zebra w-full">
                    <thead>
                        <tr>
                            <th>Дата</th>
                            <th>Интерн</th>
                            <th>Филиал</th>
                            <th>Нарушение</th>
                            <th>Категория</th>
                            <th>Заметка</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8">
                                    <span className="loading loading-spinner loading-lg"></span>
                                </td>
                            </tr>
                        ) : violations.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center py-8 text-gray-500">
                                    Нарушений не найдено
                                </td>
                            </tr>
                        ) : (
                            violations.map((v, i) => (
                                <tr key={i}>
                                    <td>{new Date(v.date).toLocaleDateString()}</td>
                                    <td className="font-medium">{v.internName}</td>
                                    <td>{v.branchName}</td>
                                    <td>{v.ruleTitle}</td>
                                    <td>
                                        <div className={`badge ${getCategoryBadge(v.category)} badge-sm`}>
                                            {v.category}
                                        </div>
                                    </td>
                                    <td className="max-w-xs truncate" title={v.notes}>{v.notes || "—"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ViolationsPage;
