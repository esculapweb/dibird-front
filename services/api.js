import axios from "axios";
import * as SecureStore from "expo-secure-store";

import { Config } from "../constants/config";
import { notifyTokenUpdate } from "./authService";

const api = axios.create({
  baseURL: Config.baseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

const getAccessToken = async () => {
  return await SecureStore.getItemAsync("token");
};

const getRefreshToken = async () => {
  return await SecureStore.getItemAsync("refreshToken");
};

const saveTokens = async ({ access, refresh }) => {
  if (access) {
    await SecureStore.setItemAsync("token", access);
    notifyTokenUpdate(access);
  }

  if (refresh) {
    await SecureStore.setItemAsync("refreshToken", refresh);
  }
};

const clearTokens = async () => {
  await SecureStore.deleteItemAsync("token");
  await SecureStore.deleteItemAsync("refreshToken");
};

api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest.url.endsWith("/api-auth/token/refresh/")) {
      await clearTokens();
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refresh = await getRefreshToken();
        if (!refresh) {
          await clearTokens();
          return Promise.reject(error);
        }

        const res = await axios.post(
          `${Config.baseUrl}/api-auth/token/refresh/`,
          { refresh }
        );

        await saveTokens(res.data);

        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;

        return api(originalRequest);
      } catch (refreshError) {
        await clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
