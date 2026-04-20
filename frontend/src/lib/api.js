import axios from "axios";

export const TOKEN_STORAGE_KEY = "forensiq_token";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function extractApiError(error, fallbackMessage) {
  return error?.response?.data?.message || fallbackMessage;
}

export default api;
