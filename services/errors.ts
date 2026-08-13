import { AxiosError } from "axios";
import Toast from "react-native-toast-message";
import * as Sentry from "@sentry/react-native";

import i18n from "./i18n";
import { AppError, ErrorExtractor, UIError } from "../types";

export const API_ERROR = {
  TIMEOUT: "TIMEOUT",
  NETWORK: "NETWORK_ERROR",
  SERVER: "SERVER_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION: "VALIDATION",
  UNKNOWN: "UNKNOWN",
} as const;

export type ApiErrorCode = (typeof API_ERROR)[keyof typeof API_ERROR];

export const normalizeApiError = (error: AxiosError): AppError => {
  const status = error.response?.status;

  if (error.code === "ECONNABORTED") {
    return { ...error, code: API_ERROR.TIMEOUT, isTimeout: true, status };
  }

  if (!error.response) {
    const looksLikeTimeout =
      !!error.config?.timeout && error.message === "Network Error";
    return looksLikeTimeout
      ? { ...error, code: API_ERROR.TIMEOUT, isTimeout: true }
      : { ...error, code: API_ERROR.NETWORK, isNetworkError: true, status };
  }

  if (status === 401) return { ...error, code: API_ERROR.UNAUTHORIZED, status };
  if (status === 400) return { ...error, code: API_ERROR.VALIDATION, status };
  if (status && status >= 500) {
    return { ...error, code: API_ERROR.SERVER, isServerError: true, status };
  }

  return { ...error, code: API_ERROR.UNKNOWN, status };
};

export const extractServerMessage = (error: AppError): string | null => {
  const data = error.response?.data;

  if (!data || typeof data !== "object") return null;

  if (
    Array.isArray(data.non_field_errors) &&
    data.non_field_errors.length > 0
  ) {
    return data.non_field_errors[0] ?? null;
  }

  const first = Object.values(data).flat().find(Boolean);
  return typeof first === "string" ? first : null;
};

const getErrorPolicy = (): Record<
  ApiErrorCode,
  { title: string; message: string }
> => ({
  [API_ERROR.TIMEOUT]: {
    title: i18n.t("connection_timeout"),
    message: i18n.t("server_timeout"),
  },

  [API_ERROR.NETWORK]: {
    title: i18n.t("no_connection"),
    message: i18n.t("unable_connect_server"),
  },

  [API_ERROR.SERVER]: {
    title: i18n.t("server_error"),
    message: i18n.t("server_unavailable"),
  },

  [API_ERROR.UNAUTHORIZED]: {
    title: i18n.t("token_expired"),
    message: i18n.t("please_login_again"),
  },

  [API_ERROR.VALIDATION]: {
    title: i18n.t("invalid_data"),
    message: "",
  },

  [API_ERROR.UNKNOWN]: {
    title: i18n.t("unexpected_error"),
    message: i18n.t("something_went_wrong"),
  },
});

export const toUIError = (
  error: AppError,
  extractor?: ErrorExtractor,
): UIError => {
  if (extractor) {
    const { title, message } = extractor(error);
    return { code: error.code, status: error.status, title, message };
  }

  const policy = getErrorPolicy();
  const fallback =
    policy[error.code as ApiErrorCode] ?? policy[API_ERROR.UNKNOWN];

  const serverMessage = extractServerMessage(error);

  return {
    code: error.code,
    status: error.status,
    title: fallback.title,
    message: serverMessage || fallback.message,
  };
};

export const showError = (e: unknown, extractor?: ErrorExtractor): void => {
  const error = e as AppError;
  const { title, message } = toUIError(error, extractor);
  Toast.show({ type: "error", text1: title, text2: message || undefined });
};

/**
 * A failure the user cannot be told about and cannot act on, but which must not
 * disappear either — a push token that never reached the backend, a permission
 * that could not be read.
 *
 * `logError` alone is not enough for those: it is `__DEV__`-only by design, and a
 * console is no help in a build someone is holding in their hands. This is the
 * one sanctioned door to Sentry outside `services/api.ts` — what the convention
 * rules out is `Sentry.captureException` scattered over call sites, not the
 * reporting itself.
 *
 * Nothing HTTP belongs here: an API call that failed is already reported by the
 * interceptor in `services/api.ts`, and a second event would only split one
 * problem in two.
 */
export const reportWarning = (
  e: unknown,
  tag: string,
  extra?: Record<string, unknown>,
): void => {
  logError(e, tag);

  const error = e as AppError;
  const context = {
    level: "warning" as const,
    tags: { context: tag },
    extra: { ...extra, code: error?.code },
  };

  // A non-Error thrown from a native module would become an "Object captured as
  // exception" event with no message worth reading.
  if (e instanceof Error) {
    Sentry.captureException(e, context);
  } else {
    Sentry.captureMessage(`${tag}: ${String(e)}`, context);
  }
};

export const logError = (e: unknown, tag = "useApiError"): void => {
  if (!__DEV__) return;

  const error = e as AppError;

  const data = {
    code: error.code,
    status: error.status,
    data: error.response?.data,
    message: error.message,
  };

  if (error.status && error.status >= 500) {
    console.error(`[${tag}]`, data);
  } else {
    console.warn(`[${tag}]`, data);
  }
};
