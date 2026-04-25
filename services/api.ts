import axios, { AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import i18n from "./i18n";
import Toast from "react-native-toast-message";
import * as Sentry from '@sentry/react-native';

import { Config } from "../constants/config";
import { notifyTokenUpdate } from "./authService";
import { canUseBiometrics } from "./bio";

export interface AppError extends Error {
  code?: string;
  status?: number;
  title?: string;
  isTimeout?: boolean;
  isNetworkError?: boolean;
  isServerError?: boolean;
  originalError?: unknown;
  response?: any;
}

let onUnauthorizedCallback: (() => void) | null = null;

export const setOnUnauthorized = (fn: () => void) => {
  onUnauthorizedCallback = fn;
};

const API_ERROR = {
  TIMEOUT: "TIMEOUT",
  NETWORK: "NETWORK_ERROR",
  SERVER: "SERVER_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  UNKNOWN: "UNKNOWN",
};

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

const normalizeApiError = (error: AxiosError): AxiosError & AppError => {
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

export const mapErrorToToast = (e: AppError, extractApiErrorFn: ((error: AppError) => { title: string; message: string }) | null = null) => {
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

export const showError = (e: AppError, extractApiErrorFn?: ((e: AppError) => { title: string; message: string }) | null) => {
  const { title, message } = mapErrorToToast(e, extractApiErrorFn);
  Toast.show({
    type: "error",
    text1: title,
    text2: message,
  });
};

const createTranslatedError = (error: AxiosError): AppError => {
  const normalizedError = normalizeApiError(error);

  const { title, message } = mapErrorToToast(normalizedError, null);

  const translatedError = new Error(message) as AppError;

  translatedError.title = title;
  translatedError.message = message;
  translatedError.code = normalizedError.code;
  translatedError.status = normalizedError.status;
  translatedError.originalError = error;
  translatedError.response = error.response;

  translatedError.isTimeout = normalizedError.isTimeout;
  translatedError.isNetworkError = normalizedError.isNetworkError;
  translatedError.isServerError = normalizedError.isServerError;

  return translatedError;
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

export const saveTokens = async ({ access, refresh }: { access?: string; refresh?: string }) => {

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
    if (!config.url) return config;
    
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
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      Sentry.captureException(error);
      return Promise.reject(createTranslatedError(error));
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
        const axiosError = e as AxiosError;
        const status = axiosError?.response?.status;
        if (status === 401 || status === 400) {
          onUnauthorizedCallback?.();
        }
        return Promise.reject(createTranslatedError(axiosError));
      }
    }

    if (error.response?.status >= 500) {
      Sentry.captureException(error);
    }

    return Promise.reject(createTranslatedError(error));
  },
);

export const getErrorDetails = (error: AppError) => {
  if (error?.title && error?.message) {
    return {
      title: error.title,
      message: error.message,
      code: error.code,
      status: error.status,
    };
  }

  const { title, message } = mapErrorToToast(error);
  return {
    title,
    message,
    code: error.code,
    status: error.status,
  };
};

export default api;
