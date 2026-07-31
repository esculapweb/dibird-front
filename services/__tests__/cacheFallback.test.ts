jest.mock("../sync/networkStatus", () => ({ isConnected: jest.fn() }));

import * as Sentry from "@sentry/react-native";

import { isConnected } from "../sync/networkStatus";
import {
  classifyFallback,
  serveFromCache,
  assertNotGone,
  cachedRead,
} from "../cacheFallback";
import { AppError } from "../../types";

const captureMessage = Sentry.captureMessage as jest.Mock;
const connected = isConnected as jest.Mock;

// The errors that reach the fallbacks are AppError from createTranslatedError:
// status is only there when the server actually replied.
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
    // There is a network but no answer: a timeout, DNS, a dead server — that is
    // already a signal.
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

describe("cachedRead", () => {
  it("skips the request entirely when offline and the answer is already local", async () => {
    connected.mockReturnValue(false);
    const request = jest.fn();

    await expect(cachedRead("fetchBirdOfDay", () => "cached", request)).resolves.toBe(
      "cached",
    );
    // This is what the whole branch exists for: an offline request does not fail
    // right away but hangs until the `timeout: 10000` in api.ts.
    expect(request).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("still tries the network when offline with nothing local — NetInfo can be wrong", async () => {
    connected.mockReturnValue(false);
    const request = jest.fn().mockResolvedValue("live");

    await expect(cachedRead("fetchBirdOfDay", () => null, request)).resolves.toBe("live");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("falls back to the cache when the request fails", async () => {
    const boom = err({ status: 500 });
    const request = jest.fn().mockRejectedValue(boom);

    await expect(cachedRead("fetchBirdOfDay", () => "cached", request)).resolves.toBe(
      "cached",
    );
    // There was a network and the response was replaced by the cache — that is
    // already a reason for Sentry.
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  it("rethrows when the request fails and there is nothing cached", async () => {
    const boom = err({ status: 500 });
    await expect(
      cachedRead("fetchBirdOfDay", () => null, jest.fn().mockRejectedValue(boom)),
    ).rejects.toBe(boom);
  });

  it("runs onRequestError before the cache read, so assertNotGone still wins", async () => {
    const gone = err({ status: 404 });
    const readCache = jest.fn(() => "cached");

    await expect(
      cachedRead(
        "fetchTaxonDetail",
        readCache,
        jest.fn().mockRejectedValue(gone),
        assertNotGone,
      ),
    ).rejects.toBe(gone);
    expect(readCache).not.toHaveBeenCalled();
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
