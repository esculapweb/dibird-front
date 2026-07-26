jest.mock("../sync/networkStatus", () => ({ isConnected: jest.fn() }));

import * as Sentry from "@sentry/react-native";

import { isConnected } from "../sync/networkStatus";
import { classifyFallback, serveFromCache, assertNotGone } from "../cacheFallback";
import { AppError } from "../../types";

const captureMessage = Sentry.captureMessage as jest.Mock;
const connected = isConnected as jest.Mock;

// Ошибки, доезжающие до фолбэков, — это AppError из createTranslatedError:
// status есть только когда сервер реально ответил.
const err = (fields: Partial<AppError>): AppError =>
  Object.assign(new Error("boom"), { code: "UNKNOWN" }, fields) as AppError;

beforeEach(() => {
  jest.clearAllMocks();
  connected.mockReturnValue(true);
});

describe("classifyFallback", () => {
  it("treats a missing status as offline when NetInfo says there's no connection", () => {
    connected.mockReturnValue(false);
    expect(classifyFallback(err({ isTimeout: true }))).toBe("offline");
    expect(classifyFallback(err({ isNetworkError: true }))).toBe("offline");
  });

  it("treats a missing status as unreachable while the connection is up", () => {
    // Сеть есть, а ответа нет: таймаут, DNS, лежащий сервер — это уже сигнал.
    expect(classifyFallback(err({ isTimeout: true }))).toBe("unreachable");
    expect(classifyFallback(err({ status: 0 }))).toBe("unreachable");
  });

  it("classifies by status code whenever the server did answer", () => {
    expect(classifyFallback(err({ status: 500 }))).toBe("server");
    expect(classifyFallback(err({ status: 503 }))).toBe("server");
    expect(classifyFallback(err({ status: 404 }))).toBe("client");
    expect(classifyFallback(err({ status: 403 }))).toBe("client");
  });

  it("does not depend on the connection flag once there is a status", () => {
    connected.mockReturnValue(false);
    expect(classifyFallback(err({ status: 500 }))).toBe("server");
  });
});

describe("serveFromCache", () => {
  it("stays silent for a plain offline read", () => {
    connected.mockReturnValue(false);
    expect(serveFromCache(["cached"], err({ isTimeout: true }), "fetchSpecies")).toEqual(["cached"]);
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("flags a 5xx masked by the cache, and still returns the cached data", () => {
    const value = { results: [1] };
    expect(serveFromCache(value, err({ status: 500 }), "fetchSpecies")).toBe(value);
    expect(captureMessage).toHaveBeenCalledTimes(1);
    const [message, options] = captureMessage.mock.calls[0];
    expect(message).toContain("500");
    expect(message).toContain("fetchSpecies");
    expect(options.level).toBe("warning");
    expect(options.tags).toMatchObject({
      degraded_read: "true",
      source: "fetchSpecies",
      fallback_reason: "server",
      http_status: "500",
    });
  });

  it("flags a 4xx and a no-response-while-online read too", () => {
    serveFromCache(null, err({ status: 403 }), "fetchPage");
    serveFromCache(null, err({ isTimeout: true }), "fetchPage");
    expect(captureMessage).toHaveBeenCalledTimes(2);
    expect(captureMessage.mock.calls[0][1].tags.fallback_reason).toBe("client");
    expect(captureMessage.mock.calls[1][1].tags).toMatchObject({
      fallback_reason: "unreachable",
      http_status: "0",
    });
  });
});

describe("assertNotGone", () => {
  it("rethrows 404 and 410 so a deleted entity stops being served from cache", () => {
    const gone = err({ status: 404 });
    expect(() => assertNotGone(gone)).toThrow(gone);
    expect(() => assertNotGone(err({ status: 410 }))).toThrow();
  });

  it("lets every other failure through to the cache fallback", () => {
    expect(() => assertNotGone(err({ status: 500 }))).not.toThrow();
    expect(() => assertNotGone(err({ status: 403 }))).not.toThrow();
    expect(() => assertNotGone(err({ isTimeout: true }))).not.toThrow();
  });
});
