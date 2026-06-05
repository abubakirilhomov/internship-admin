import { authFetch as fetch, getAuthToken } from "./authFetch";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

// authFetch injects Authorization on every call. Most callers pass only
// Content-Type via this helper, so we keep it minimal — the Authorization
// header is now applied centrally inside authFetch from the in-memory token.
const getAuthHeaders = () => ({
  "Content-Type": "application/json",
});

export const api = {
  // Interns
  interns: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/interns`, {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
    upgrade: async (id, options) => {
      // options может быть либо просто грейдом (строка) либо объектом с параметрами
      const payload = typeof options === 'string'
        ? { newGrade: options }
        : {
          newGrade: options.grade || options.newGrade,
          withConcession: options.withConcession,
          percentage: options.percentage,
          note: options.note
        };

      const response = await fetch(`${API_BASE_URL}/interns/${id}/upgrade`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Ошибка при повышении грейда`);
      }

      return response.json();
    },

    create: async (data) => {
      const response = await fetch(`${API_BASE_URL}/interns`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при создании стажёра");
      }
      return response.json();
    },
    getRating: async () => {
      const response = await fetch(`${API_BASE_URL}/interns/rating`, {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
    update: async (id, data) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при обновлении стажёра");
      }
      return response.json();
    },
    delete: async (id) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }
      return response.status === 204 ? {} : await response.json();
    },
    resetPassword: async (id) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/reset-password`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to reset password");
      }
      return response.json();
    },
    rate: async (id, rating) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/rate`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ rating }),
      });
      return response.json();
    },
    addLessonVisit: async (id, lessonData) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/lessons`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(lessonData),
      });
      return response.json();
    },
    addBonus: async (id, data) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/bonus-lessons`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при добавлении бонуса");
      }
      return response.json();
    },
    setHeadIntern: async (id, isHeadIntern, branchId) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/head-intern`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isHeadIntern, branchId }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при обновлении статуса Head Intern");
      }
      return response.json();
    },
    setActivation: async (id, isEnabled, note = "") => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/activation`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isEnabled, note }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при смене статуса активации");
      }
      return response.json();
    },
    freeze: async (id, payload) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/freeze`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload || {}),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при заморозке");
      }
      return response.json();
    },
    unfreeze: async (id) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/unfreeze`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при разморозке");
      }
      return response.json();
    },
    archive: async (id, payload) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/archive`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload || {}),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при архивации");
      }
      return response.json();
    },
    unarchive: async (id) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/unarchive`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при разархивации");
      }
      return response.json();
    },
    getFrozen: async () => {
      const response = await fetch(`${API_BASE_URL}/interns/frozen`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при загрузке списка замороженных");
      }
      return response.json();
    },
    getArchived: async () => {
      const response = await fetch(`${API_BASE_URL}/interns/archived`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при загрузке архива");
      }
      return response.json();
    },
    // Phase 2 weekly-plan: snap status (restricted | admin_block) → ok.
    // selfActivations counter is NOT reset (user pick on open question #4
    // in vault/weekly-self-activation-plan.md). Streak stays at 0.
    clearWeeklyPlanBlock: async (id) => {
      const response = await fetch(`${API_BASE_URL}/interns/${id}/clear-block`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при снятии блока");
      }
      return response.json();
    },
  },

  // Branches
  branches: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/branches`, {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
    create: async (data) => {
      const response = await fetch(`${API_BASE_URL}/branches`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return response.json();
    },
    update: async (id, data) => {
      const response = await fetch(`${API_BASE_URL}/branches/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Ошибка при обновлении филиала');
      return response.json();
    },
    delete: async (id) => {
      const response = await fetch(`${API_BASE_URL}/branches/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  },

  // Mentors
  mentors: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/mentors`, {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
    create: async (data) => {
      const response = await fetch(`${API_BASE_URL}/mentors`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return response.json();
    },
    update: async (id, data) => {
      const response = await fetch(`${API_BASE_URL}/mentors/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to update mentor`);
      }
      return response.json();
    },
    delete: async (id) => {
      const response = await fetch(`${API_BASE_URL}/mentors/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (response.status === 204) return {};
      return response.json();
    },
    resetPassword: async (id) => {
      const response = await fetch(`${API_BASE_URL}/mentors/${id}/reset-password`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to reset password`);
      }
      return response.json();
    },
    getStats: async (id) => {
      const response = await fetch(`${API_BASE_URL}/mentors/${id}/stats`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Ошибка загрузки статистики ментора");
      return response.json();
    },
    getAllDebt: async () => {
      const response = await fetch(`${API_BASE_URL}/mentors/debt/all`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch mentor debt");
      const json = await response.json();
      return json.data; // Return data array directly
    },
    getDebtDetails: async (id) => {
      const response = await fetch(`${API_BASE_URL}/mentors/${id}/debt-details`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch debt details");
      const json = await response.json();
      return json.data;
    },
    getActivityList: async () => {
      const response = await fetch(`${API_BASE_URL}/mentors/with-activity`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Ошибка загрузки активности менторов");
      const json = await response.json();
      return json.data;
    },
    getInternsActivity: async (id) => {
      const response = await fetch(`${API_BASE_URL}/mentors/${id}/interns-activity`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Ошибка загрузки интернов ментора");
      const json = await response.json();
      return json.data;
    },
  },
  rules: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/rules?limit=1000`, {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
    create: async (data) => {
      const response = await fetch(`${API_BASE_URL}/rules`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      return response.json();
    },
    delete: async (id) => {
      if (!id) throw new Error("Rule ID is required");
      const response = await fetch(`${API_BASE_URL}/rules/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  },
  violations: {
    getAll: async (params) => {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`${API_BASE_URL}/violations?${queryString}`, {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  },
  lessons: {
    getStuckFeedbacks: async () => {
      const response = await fetch(`${API_BASE_URL}/lessons/stuck-feedbacks`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Ошибка загрузки застрявших фидбеков");
      return response.json();
    },
    forceCloseFeedback: async (lessonId, note = "") => {
      const response = await fetch(
        `${API_BASE_URL}/lessons/${lessonId}/force-feedback`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ note }),
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при закрытии фидбека");
      }
      return response.json();
    },
    getAttendanceStats: async (params = {}) => {
      if (params.period === "previousMonth") {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);

        params.startDate = start.toISOString().split("T")[0];
        params.endDate = end.toISOString().split("T")[0];

        delete params.period;
      }

      const query = new URLSearchParams(params).toString();
      const response = await fetch(
        `${API_BASE_URL}/lessons/attendance-stats?${query}`,
        {
          headers: getAuthHeaders(),
        }
      );

      return response.json();
    },
  },
  lessonCriteria: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/lesson-criteria?all=true`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Ошибка загрузки критериев");
      return response.json();
    },
    create: async (data) => {
      const response = await fetch(`${API_BASE_URL}/lesson-criteria`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при создании критерия");
      }
      return response.json();
    },
    update: async (id, data) => {
      const response = await fetch(`${API_BASE_URL}/lesson-criteria/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при обновлении критерия");
      }
      return response.json();
    },
    deactivate: async (id) => {
      const response = await fetch(`${API_BASE_URL}/lesson-criteria/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ошибка при деактивации критерия");
      }
      return response.json();
    },
  },
  gradeConfig: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/grade-config`, { headers: getAuthHeaders() });
      return response.json();
    },
    update: async (grade, data) => {
      const response = await fetch(`${API_BASE_URL}/grade-config/${grade}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  },
  settings: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
    update: async (data) => {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  },
  uploads: {
    uploadImage: async (file, folder = "profiles") => {
      const token = getAuthToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const response = await fetch(`${API_BASE_URL}/uploads/image`, {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Ошибка загрузки изображения");
      }

      return data.data;
    },
  },
  applications: {
    getAll: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.append(k, v);
      });
      const q = qs.toString();
      const response = await fetch(
        `${API_BASE_URL}/applications${q ? `?${q}` : ""}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    getById: async (id) => {
      const response = await fetch(`${API_BASE_URL}/applications/${id}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    updateStatus: async (id, data) => {
      const response = await fetch(`${API_BASE_URL}/applications/${id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    convert: async (id) => {
      const response = await fetch(`${API_BASE_URL}/applications/${id}/convert`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    retryNotify: async (id) => {
      const response = await fetch(
        `${API_BASE_URL}/applications/${id}/retry-notify`,
        { method: "POST", headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    adminCreate: async (data) => {
      const response = await fetch(`${API_BASE_URL}/applications/admin-create`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  },
  interviews: {
    getAll: async (params = {}) => {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.append(k, v);
      });
      const q = qs.toString();
      const response = await fetch(
        `${API_BASE_URL}/interviews${q ? `?${q}` : ""}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    schedule: async (data) => {
      const response = await fetch(`${API_BASE_URL}/interviews/schedule`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    updateStatus: async (id, status) => {
      const response = await fetch(`${API_BASE_URL}/interviews/${id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    reschedule: async (id, scheduledAt) => {
      const response = await fetch(`${API_BASE_URL}/interviews/${id}/reschedule`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ scheduledAt }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  },
};
