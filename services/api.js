import axios from "axios";
import * as SecureStore from "expo-secure-store";
import i18n from "./i18n";

import { Config } from "../constants/config";
import { notifyTokenUpdate } from "./authService";
import { canUseBiometrics } from "./bio";

export const API_ERROR = {
  TIMEOUT: "TIMEOUT",
  NETWORK: "NETWORK_ERROR",
  SERVER: "SERVER_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  UNKNOWN: "UNKNOWN",
};

export const normalizeApiError = (error) => {
  if (error.code === "ECONNABORTED") {
    return {
      ...error,
      code: API_ERROR.TIMEOUT,
      isTimeout: true,
    };
  }

  if (!error.response) {
    return {
      ...error,
      code: API_ERROR.NETWORK,
      isNetworkError: true,
    };
  }

  if (error.response.status >= 500) {
    return {
      ...error,
      code: API_ERROR.SERVER,
      status: error.response.status,
      isServerError: true,
    };
  }

  if (error.response.status === 401) {
    return {
      ...error,
      code: API_ERROR.UNAUTHORIZED,
    };
  }

  return {
    ...error,
    code: API_ERROR.UNKNOWN,
    status: error.response?.status,
  };
};

export const mapErrorToToast = (err, extractApiErrorFn = null) => {
  if (err.code === API_ERROR.TIMEOUT)
    return { title: i18n.t("connection_timeout"), message: i18n.t("server_timeout") };

  if (err.code === API_ERROR.NETWORK)
    return { title: i18n.t("no_connection"), message: i18n.t("unable_connect_server") };

  if (err.code === API_ERROR.SERVER)
    return { title: i18n.t("server_error"), message: i18n.t("server_unavailable") };

  if (err?.response?.data && typeof extractApiErrorFn === "function") {
    const result = extractApiErrorFn(err);
    if (result?.title && result?.message) return result;
  }

  return { title: i18n.t("unexpected_error"), message: i18n.t("something_went_wrong") };
};

const api = axios.create({
  baseURL: Config.baseUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getAccessToken = () => {
  return SecureStore.getItemAsync("access");
};

export const getRefreshToken = () => {
  return SecureStore.getItemAsync("refresh");
};

export const saveTokens = async ({ access, refresh }) => {
  if (access) {
    await SecureStore.setItemAsync("access", access);
    notifyTokenUpdate(access);
  }

  if (refresh) {
    await SecureStore.setItemAsync("refresh", refresh, {
      requireAuthentication: await canUseBiometrics(),
    });
  }
};

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync("access");
  await SecureStore.deleteItemAsync("refresh");
};

api.interceptors.request.use(
  async (config) => {
    const lang = i18n.language || "en";
    const token = await getAccessToken();

    if (lang !== "en" && !config.url.startsWith(`/${lang}/`))
      config.url = `/${lang}${config.url}`;
    if (
      !config.url.includes("/api-auth/login") &&
      !config.url.includes("/api-auth/registration") &&
      token
    )
      config.headers.Authorization = `Bearer ${token}`;

    console.log(
      "API request:",
      config.method,
      config.url,
      config.headers.Authorization ? "with token" : "no token"
    );

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (originalRequest?.url?.endsWith("/api-auth/token/refresh/")) {
      await clearTokens();
      return Promise.reject(normalizeApiError(error));
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refresh = await getRefreshToken();
        if (!refresh) {
          await clearTokens();
          return Promise.reject(normalizeApiError(error));
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
        return Promise.reject(normalizeApiError(refreshError));
      }
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export default api;
