import axios, { AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import * as Sentry from "@sentry/react-native";
import i18n from "./i18n";

import { Config } from "../constants/config";
import { notifyTokenUpdate } from "./authService";
import { AppError } from "../types";
import { normalizeApiError, toUIError } from "./errors";

let onUnauthorizedCallback: (() => void) | null = null;

export const setOnUnauthorized = (fn: (() => void) | null) => {
  onUnauthorizedCallback = fn;
};

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
let isLoggingOut = false;
let cachedAccessToken: string | null = null;

const api = axios.create({
  baseURL: Config.baseUrl,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  const token = await SecureStore.getItemAsync("access");
  if (token) cachedAccessToken = token;
  return token;
};

let cachedRefreshToken: string | null = null;

export const getRefreshToken = async (): Promise<string | null> => {
  if (cachedRefreshToken) return cachedRefreshToken;
  const token = await SecureStore.getItemAsync("refresh");
  if (token) cachedRefreshToken = token;
  return token;
};

export const saveTokens = async ({
  access,
  refresh,
}: {
  access?: string;
  refresh?: string;
}): Promise<void> => {
  isLoggingOut = false;
  if (access) {
    cachedAccessToken = access;
    await SecureStore.setItemAsync("access", access);
    notifyTokenUpdate(access);
  }
  if (refresh) {
    cachedRefreshToken = refresh;
    await SecureStore.setItemAsync("refresh", refresh);
  }
};

export const clearTokens = async (): Promise<void> => {
  isLoggingOut = false;
  cachedAccessToken = null;
  cachedRefreshToken = null;
  await SecureStore.deleteItemAsync("access");
  await SecureStore.deleteItemAsync("refresh");
};

const refreshAccessToken = async (): Promise<string> => {
  const refresh = await getRefreshToken();
  if (!refresh) throw new Error("No refresh token");

  const { data } = await axios.post(
    `${Config.baseUrl}/api-auth/token/refresh/`,
    { refresh },
  );

  await saveTokens(data);
  return data.access as string;
};

export const createTranslatedError = (error: AxiosError): AppError => {
  const normalized = normalizeApiError(error);
  const { title, message } = toUIError(normalized);

  return Object.assign(new Error(message) as AppError, {
    title,
    message,
    code: normalized.code,
    status: normalized.status,
    originalError: error,
    response: error.response,
    isTimeout: normalized.isTimeout,
    isNetworkError: normalized.isNetworkError,
    isServerError: normalized.isServerError,
  });
};

const reportToSentry = (error: AxiosError): void => {
  const status = error.response?.status ?? 0;
  const url = error.config?.url ?? "unknown";
  const method = (error.config?.method ?? "GET").toUpperCase();

  if (status >= 500) {
    Sentry.captureException(error, {
      tags: { api_url: url, http_method: method, http_status: status },
    });
    return;
  }

  if (status === 0) {
    const isTimeout = error.code === "ECONNABORTED";
    Sentry.captureMessage(
      `API ${method} ${url} → ${isTimeout ? "timeout" : "network error"}`,
      {
        level: "warning",
        extra: { url, method, errorCode: error.code },
      },
    );
    return;
  }

  const warnStatuses: Record<number, string> = {
    403: "Forbidden — возможно проблема с правами",
    404: "Not Found — возможно устаревший endpoint",
    429: "Rate limit exceeded",
  };

  if (status in warnStatuses) {
    Sentry.captureMessage(`API ${method} ${url} → ${status}`, {
      level: "warning",
      extra: {
        status,
        url,
        method,
        hint: warnStatuses[status],
        responseData: error.response?.data,
      },
    });
  }
};

type RetryableConfig = NonNullable<AxiosError["config"]> & {
  _retry?: boolean;
  _tokenUsed?: string;
};

api.interceptors.request.use(
  async (config) => {
    if (!config.url) return config;

    const lang = i18n.language || "en";
    const token = await getAccessToken();

    if (lang !== "en" && !config.url.startsWith(`/${lang}/`)) {
      config.url = `/${lang}${config.url}`;
    }

    const isPublicEndpoint = Config.publicEndpoints.some((endpoint) =>
      config.url?.includes(endpoint),
    );

    if (!isPublicEndpoint && token) {
      config.headers.Authorization = `Bearer ${token}`;
      (config as RetryableConfig)._tokenUsed = token; // <-- новое поле
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (!originalRequest) {
      reportToSentry(error);
      return Promise.reject(createTranslatedError(error));
    }

    const is401 =
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.endsWith("/api-auth/token/refresh/") &&
      !originalRequest.url?.endsWith("/api-auth/logout/");

    if (is401) {
      if (isLoggingOut) {
        return Promise.reject(
        Object.assign(new Error("Logged out"), { code: "LOGGED_OUT" })
      );
      }
      originalRequest._retry = true;

      // Если токен уже обновился без нас (другой запрос успел отрефрешить) —
      // просто ретраим с актуальным токеном, НЕ трогая refresh.
      const latestAccess = await getAccessToken();
      if (latestAccess && latestAccess !== originalRequest._tokenUsed) {
        originalRequest.headers!.Authorization = `Bearer ${latestAccess}`;
        return api(originalRequest);
      }

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = refreshAccessToken().finally(() => {
            isRefreshing = false;
            refreshPromise = null;
          });
        }

        const newAccess = await refreshPromise!;

        originalRequest.headers!.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (e) {
        const refreshError = e as AxiosError;
        const status = refreshError?.response?.status;

        if (status === 401 || status === 400) {
          if (!isLoggingOut) { 
            isLoggingOut = true;
            await clearTokens();
            onUnauthorizedCallback?.();
          }
          return new Promise(() => {});
        }
        reportToSentry(refreshError);
        return Promise.reject(createTranslatedError(refreshError));
      }
    }

    reportToSentry(error);

    return Promise.reject(createTranslatedError(error));
  },
);

export default api;
