import axios from "axios";
import * as SecureStore from "expo-secure-store";
import i18n from "./i18n";
import Toast from "react-native-toast-message";

import { Config } from "../constants/config";
import { notifyTokenUpdate } from "./authService";
import { canUseBiometrics } from "./bio";

const API_ERROR = {
  TIMEOUT: "TIMEOUT",
  NETWORK: "NETWORK_ERROR",
  SERVER: "SERVER_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  UNKNOWN: "UNKNOWN",
};

let isRefreshing = false;
let refreshPromise = null;

const normalizeApiError = (error) => {
  if (error.code === "ECONNABORTED") {
    return {
      ...error,
      code: API_ERROR.TIMEOUT,
      isTimeout: true,
    };
  }

  if (error.message === "Network Error" && !error.response) {
    if (error.config && error.config.timeout) {
      return {
        ...error,
        code: API_ERROR.TIMEOUT,
        isTimeout: true,
      };
    }
    return {
      ...error,
      code: API_ERROR.NETWORK,
      isNetworkError: true,
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

export const mapErrorToToast = (e, extractApiErrorFn = null) => {
  if (e.code === API_ERROR.TIMEOUT)
    return {
      title: i18n.t("connection_timeout"),
      message: i18n.t("server_timeout"),
    };

  if (e.code === API_ERROR.NETWORK)
    return {
      title: i18n.t("no_connection"),
      message: i18n.t("unable_connect_server"),
    };

  if (e.code === API_ERROR.SERVER)
    return {
      title: i18n.t("server_error"),
      message: i18n.t("server_unavailable"),
    };

  if (e?.response?.data && typeof extractApiErrorFn === "function") {
    const result = extractApiErrorFn(e);
    if (result?.title && result?.message) return result;
  }

  return {
    title: i18n.t("unexpected_error"),
    message: i18n.t("something_went_wrong"),
  };
};

export const showError = (e, extractApiErrorFn = null) => {
  const { title, message } = mapErrorToToast(e, extractApiErrorFn);
  Toast.show({
    type: "error",
    text1: title,
    text2: message,
  });
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

const refreshAccessToken = async () => {
  const refresh = await getRefreshToken();
  if (!refresh) throw new Error("No refresh token");

  const res = await axios.post(`${Config.baseUrl}/api-auth/token/refresh/`, {
    refresh,
  });

  await saveTokens(res.data);
  return res.data.access;
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

    // console.log(
    //   "API request:",
    //   config.method,
    //   config.url,
    //   config.headers.Authorization ? "with token" : "no token"
    // );

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(normalizeApiError(error));
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.endsWith("/api-auth/token/refresh/") &&
      !originalRequest.url?.endsWith("/api-auth/logout/")
    ) {
      originalRequest._retry = true;

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = refreshAccessToken().finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
        }

        const newAccess = await refreshPromise;

        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (e) {
        await clearTokens();
        return Promise.reject(normalizeApiError(e));
      }
    }

    return Promise.reject(normalizeApiError(error));
  },
);

export default api;
