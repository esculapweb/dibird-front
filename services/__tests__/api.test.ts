// services/api.ts registers its axios interceptors once at module load, so
// this test mocks `axios` itself (create() returns a fake instance whose
// interceptors.request/response.use just record the handlers it's given)
// rather than mocking services/api.ts's own exports — there's no
// axios-mock-adapter in this project, and the whole point here is to
// exercise the real interceptor logic (401 -> refresh -> retry) directly.
jest.mock("axios", () => {
  const instance: unknown = jest.fn(async () => ({ data: "retried" }));
  (instance as { interceptors: unknown }).interceptors = {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => instance),
      post: jest.fn(),
    },
  };
});
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
// jest.setup.js's global mock only provides wrap/captureException/init —
// api.ts also calls captureMessage (reportToSentry's non-5xx paths).
jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

import axios, { type AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import api, { clearTokens, saveTokens, setOnUnauthorized } from "../api";
import i18n from "../i18n";

type RetryableConfig = {
  url?: string;
  headers: Record<string, string>;
  _retry?: boolean;
  _tokenUsed?: string;
};

const requestSuccess = (
  api.interceptors.request.use as unknown as jest.Mock
).mock.calls[0][0] as (config: RetryableConfig) => Promise<RetryableConfig>;
const responseError = (
  api.interceptors.response.use as unknown as jest.Mock
).mock.calls[0][1] as (error: AxiosError) => Promise<unknown>;

const apiInstance = api as unknown as jest.Mock;
const axiosPost = axios.post as jest.Mock;
const getItemAsync = SecureStore.getItemAsync as jest.Mock;

const config = (overrides: Partial<RetryableConfig> = {}): RetryableConfig => ({
  url: "/myapi/foo/",
  headers: {},
  ...overrides,
});

const error401 = (cfg: RetryableConfig): AxiosError =>
  ({
    isAxiosError: true,
    message: "Request failed with status code 401",
    response: { status: 401 },
    config: cfg,
  }) as unknown as AxiosError;

const flush = () => new Promise((resolve) => setImmediate(resolve));

const originalLanguage = i18n.language;

beforeEach(async () => {
  jest.clearAllMocks();
  getItemAsync.mockResolvedValue(null);
  apiInstance.mockResolvedValue({ data: "retried" });
  i18n.language = "en";
  // Reset the module's internal token cache / isLoggingOut flag so tests
  // don't leak state through services/api.ts's module-level closures.
  // clearTokens() no longer resets isLoggingOut itself (see the fix in
  // api.ts) — saveTokens({}) is the one call that touches only that flag,
  // with no access/refresh to also write. Then clear the call history
  // these two just generated (their mockResolvedValue defaults above
  // survive — clearAllMocks resets calls, not implementations).
  await clearTokens();
  await saveTokens({});
  jest.clearAllMocks();
});

afterEach(() => {
  i18n.language = originalLanguage;
  setOnUnauthorized(null);
});

describe("request interceptor", () => {
  it("prefixes the url with the current language when it isn't English", async () => {
    i18n.language = "ru";
    const result = await requestSuccess(config({ url: "/myapi/foo/" }));
    expect(result.url).toBe("/ru/myapi/foo/");
  });

  it("does not prefix the url for English", async () => {
    const result = await requestSuccess(config({ url: "/myapi/foo/" }));
    expect(result.url).toBe("/myapi/foo/");
  });

  it("does not attach Authorization to a public endpoint even with a token available", async () => {
    getItemAsync.mockResolvedValue("secret-token");
    const result = await requestSuccess(config({ url: "/api-auth/login/" }));
    expect(result.headers.Authorization).toBeUndefined();
  });

  it("attaches a Bearer token to a private endpoint", async () => {
    getItemAsync.mockResolvedValue("secret-token");
    const result = await requestSuccess(config({ url: "/myapi/private/" }));
    expect(result.headers.Authorization).toBe("Bearer secret-token");
    expect(result._tokenUsed).toBe("secret-token");
  });
});

describe("response interceptor: no request context", () => {
  it("rejects without attempting a refresh when the error has no config", async () => {
    await expect(
      responseError({ isAxiosError: true, message: "boom" } as unknown as AxiosError),
    ).rejects.toBeInstanceOf(Error);
    expect(axiosPost).not.toHaveBeenCalled();
  });
});

describe("response interceptor: 401 handling", () => {
  it("retries with the latest token instead of refreshing, if another request already refreshed it", async () => {
    getItemAsync.mockResolvedValue("newer-token");
    const cfg = config({ _tokenUsed: "stale-token" });

    await responseError(error401(cfg));

    expect(axiosPost).not.toHaveBeenCalled();
    expect(cfg.headers.Authorization).toBe("Bearer newer-token");
    expect(apiInstance).toHaveBeenCalledWith(cfg);
  });

  it("refreshes the token and retries the original request on success", async () => {
    getItemAsync.mockImplementation(async (key: string) =>
      key === "access" ? "shared-token" : "old-refresh",
    );
    axiosPost.mockResolvedValueOnce({ data: { access: "new-access", refresh: "new-refresh" } });
    const cfg = config({ _tokenUsed: "shared-token" });

    await responseError(error401(cfg));

    expect(axiosPost).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("access", "new-access");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("refresh", "new-refresh");
    expect(cfg.headers.Authorization).toBe("Bearer new-access");
    expect(apiInstance).toHaveBeenCalledWith(cfg);
  });

  it("single-flights concurrent 401s onto one refresh call", async () => {
    getItemAsync.mockImplementation(async (key: string) =>
      key === "access" ? "shared-token" : "old-refresh",
    );
    axiosPost.mockResolvedValueOnce({ data: { access: "new-shared", refresh: "new-shared-r" } });
    const cfg1 = config({ url: "/myapi/a/", _tokenUsed: "shared-token" });
    const cfg2 = config({ url: "/myapi/b/", _tokenUsed: "shared-token" });

    await Promise.all([responseError(error401(cfg1)), responseError(error401(cfg2))]);

    expect(axiosPost).toHaveBeenCalledTimes(1);
    expect(cfg1.headers.Authorization).toBe("Bearer new-shared");
    expect(cfg2.headers.Authorization).toBe("Bearer new-shared");
  });

  it("on a refresh network error: rejects without forcing a logout", async () => {
    getItemAsync.mockImplementation(async (key: string) =>
      key === "access" ? "shared-token" : "old-refresh",
    );
    axiosPost.mockRejectedValueOnce({ message: "Network Error" });
    const onUnauthorized = jest.fn(async () => {});
    setOnUnauthorized(onUnauthorized);
    const cfg = config({ _tokenUsed: "shared-token" });

    await expect(responseError(error401(cfg))).rejects.toBeInstanceOf(Error);

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it("on a refresh 401/400: clears tokens and fires the forced-logout callback", async () => {
    getItemAsync.mockImplementation(async (key: string) =>
      key === "access" ? "shared-token" : "old-refresh",
    );
    axiosPost.mockRejectedValueOnce({ response: { status: 401 } });
    const onUnauthorized = jest.fn(async () => {});
    setOnUnauthorized(onUnauthorized);
    const cfg = config({ _tokenUsed: "shared-token" });

    // The 401 branch's own promise never settles (`return new Promise(() =>
    // {})`, by design — see api.ts) once it decides to force a logout, so
    // it's deliberately not awaited here; just let the internal
    // clearTokens()/onUnauthorizedCallback() chain run to completion.
    void responseError(error401(cfg));
    await flush();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("access");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("refresh");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("fires the forced-logout callback only once for two concurrent refresh failures", async () => {
    getItemAsync.mockImplementation(async (key: string) =>
      key === "access" ? "shared-token" : "old-refresh",
    );
    axiosPost.mockRejectedValueOnce({ response: { status: 401 } });
    const onUnauthorized = jest.fn(async () => {});
    setOnUnauthorized(onUnauthorized);
    const cfg1 = config({ url: "/myapi/a/", _tokenUsed: "shared-token" });
    const cfg2 = config({ url: "/myapi/b/", _tokenUsed: "shared-token" });

    void responseError(error401(cfg1));
    void responseError(error401(cfg2));
    await flush();

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not enter the refresh branch for the refresh/logout endpoints themselves", async () => {
    const cfg = config({ url: "/api-auth/token/refresh/" });

    await expect(responseError(error401(cfg))).rejects.toBeInstanceOf(Error);

    expect(axiosPost).not.toHaveBeenCalled();
    expect(apiInstance).not.toHaveBeenCalled();
  });
});
