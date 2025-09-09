const API_BASE_URL = import.meta.env.VITE_API_URL;
console.log(API_BASE_URL);
const user = JSON.parse(localStorage.getItem("user"));
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const api = {
  // Interns
  interns: {
    getAll: async () => {
      const headers = {
        ...getAuthHeaders(),
        ...(user && {
          "x-user-id": user._id,
          "x-user-role": user.role,
        }),
      };

      const response = await fetch(`${API_BASE_URL}/interns`, {
        headers: getAuthHeaders(),
      });
      return response.json();
    },
    create: async (data) => {
      const response = await fetch(`${API_BASE_URL}/interns`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      console.log(data);
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
    delete: async (id) => {
      const response = await fetch(`${API_BASE_URL}/mentors/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      return response.json();
    },
  },
  rules: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/rules`, {
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
      return response.json()
    },
  },
};
