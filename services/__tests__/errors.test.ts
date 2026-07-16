jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

import { AxiosError } from "axios";
import Toast from "react-native-toast-message";
import {
  API_ERROR,
  normalizeApiError,
  extractServerMessage,
  toUIError,
  showError,
  logError,
} from "../errors";
import { AppError } from "../../types";

const axiosError = (overrides: Partial<AxiosError> = {}): AxiosError =>
  ({
    isAxiosError: true,
    name: "AxiosError",
    message: "",
    toJSON: () => ({}),
    ...overrides,
  }) as AxiosError;

const appError = (overrides: Partial<AppError> = {}): AppError =>
  ({ name: "Error", message: "boom", code: API_ERROR.UNKNOWN, ...overrides }) as AppError;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("normalizeApiError", () => {
  it("maps ECONNABORTED to TIMEOUT", () => {
    const result = normalizeApiError(axiosError({ code: "ECONNABORTED" }));
    expect(result.code).toBe(API_ERROR.TIMEOUT);
    expect(result.isTimeout).toBe(true);
  });

  it("maps a timeout-shaped network error (has config.timeout + 'Network Error' message) to TIMEOUT", () => {
    const result = normalizeApiError(
      axiosError({ message: "Network Error", config: { timeout: 5000 } as never }),
    );
    expect(result.code).toBe(API_ERROR.TIMEOUT);
    expect(result.isTimeout).toBe(true);
  });

  it("maps any other no-response error to NETWORK", () => {
    const result = normalizeApiError(axiosError({ message: "Network Error" }));
    expect(result.code).toBe(API_ERROR.NETWORK);
    expect(result.isNetworkError).toBe(true);
  });

  it("maps a 401 response to UNAUTHORIZED", () => {
    const result = normalizeApiError(
      axiosError({ response: { status: 401 } as never }),
    );
    expect(result.code).toBe(API_ERROR.UNAUTHORIZED);
    expect(result.status).toBe(401);
  });

  it("maps a 400 response to VALIDATION", () => {
    const result = normalizeApiError(
      axiosError({ response: { status: 400 } as never }),
    );
    expect(result.code).toBe(API_ERROR.VALIDATION);
  });

  it("maps a 5xx response to SERVER", () => {
    const result = normalizeApiError(
      axiosError({ response: { status: 503 } as never }),
    );
    expect(result.code).toBe(API_ERROR.SERVER);
    expect(result.isServerError).toBe(true);
  });

  it("maps any other status to UNKNOWN", () => {
    const result = normalizeApiError(
      axiosError({ response: { status: 418 } as never }),
    );
    expect(result.code).toBe(API_ERROR.UNKNOWN);
    expect(result.status).toBe(418);
  });
});

describe("extractServerMessage", () => {
  it("returns null when there's no response data", () => {
    expect(extractServerMessage(appError())).toBeNull();
  });

  it("returns null when response data isn't an object", () => {
    expect(
      extractServerMessage(appError({ response: { data: "oops" } as never })),
    ).toBeNull();
  });

  it("prefers the first non_field_errors entry", () => {
    expect(
      extractServerMessage(
        appError({
          response: {
            data: { non_field_errors: ["Bad credentials"], email: ["ignored"] },
          } as never,
        }),
      ),
    ).toBe("Bad credentials");
  });

  it("falls back to the first truthy field value when non_field_errors is absent/empty", () => {
    expect(
      extractServerMessage(
        appError({ response: { data: { non_field_errors: [], email: ["Email taken"] } } as never }),
      ),
    ).toBe("Email taken");
  });

  it("returns null when no field value is a string", () => {
    expect(
      extractServerMessage(appError({ response: { data: { some_flag: false } } as never })),
    ).toBeNull();
  });
});

describe("toUIError", () => {
  it("uses the extractor's title/message when provided, keeping code/status", () => {
    const extractor = jest.fn(() => ({ title: "Custom title", message: "Custom message" }));
    const result = toUIError(appError({ code: API_ERROR.VALIDATION, status: 400 }), extractor);

    expect(result).toEqual({
      code: API_ERROR.VALIDATION,
      status: 400,
      title: "Custom title",
      message: "Custom message",
    });
  });

  it("falls back to the error-code policy without an extractor", () => {
    const result = toUIError(appError({ code: API_ERROR.TIMEOUT }));
    expect(result.title).toBe("Connection timeout");
    expect(result.message).toBe("The server is taking too long to respond");
  });

  it("prefers a server-provided message over the policy fallback", () => {
    const result = toUIError(
      appError({
        code: API_ERROR.VALIDATION,
        response: { data: { non_field_errors: ["Specific server reason"] } } as never,
      }),
    );
    expect(result.title).toBe("Invalid data");
    expect(result.message).toBe("Specific server reason");
  });

  it("falls back to the UNKNOWN policy for an unrecognized code", () => {
    const result = toUIError(appError({ code: "SOMETHING_WEIRD" }));
    expect(result.title).toBe("An unexpected error occurred");
    expect(result.message).toBe("Something went wrong");
  });
});

describe("showError", () => {
  it("shows a toast with the resolved title/message", () => {
    showError(appError({ code: API_ERROR.NETWORK }));
    expect(Toast.show).toHaveBeenCalledWith({
      type: "error",
      text1: "No internet connection",
      text2: "Unable to connect to the server. Please try again later.",
    });
  });

  it("passes text2 as undefined when the resolved message is empty", () => {
    showError(appError({ code: API_ERROR.VALIDATION }));
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text2: undefined }),
    );
  });

  it("forwards a custom extractor through to toUIError", () => {
    const extractor = jest.fn(() => ({ title: "T", message: "M" }));
    showError(appError(), extractor);
    expect(extractor).toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: "T", text2: "M" }),
    );
  });
});

describe("logError", () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("uses console.error for a 5xx status", () => {
    logError(appError({ status: 500 }), "MyTag");
    expect(errorSpy).toHaveBeenCalledWith(
      "[MyTag]",
      expect.objectContaining({ status: 500 }),
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("uses console.warn for a non-5xx (or missing) status", () => {
    logError(appError({ status: 400 }), "MyTag");
    expect(warnSpy).toHaveBeenCalledWith(
      "[MyTag]",
      expect.objectContaining({ status: 400 }),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("defaults the tag to 'useApiError'", () => {
    logError(appError());
    expect(warnSpy).toHaveBeenCalledWith("[useApiError]", expect.anything());
  });

  it("does nothing when __DEV__ is false", () => {
    const original = (global as { __DEV__?: boolean }).__DEV__;
    (global as { __DEV__?: boolean }).__DEV__ = false;
    try {
      logError(appError({ status: 500 }));
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      (global as { __DEV__?: boolean }).__DEV__ = original;
    }
  });
});
