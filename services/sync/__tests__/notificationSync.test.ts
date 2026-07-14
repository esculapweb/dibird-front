jest.mock("../../api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));
jest.mock("../../queryClient", () => ({
  queryClient: { invalidateQueries: jest.fn() },
}));
jest.mock("../../../hooks/repositories/notificationRepository", () => ({
  claimNextMutation: jest.fn(),
  requeuePendingMutation: jest.fn(),
}));
jest.mock("../networkStatus", () => ({
  isConnected: jest.fn(() => true),
}));

import api from "../../api";
import { queryClient } from "../../queryClient";
import * as notificationRepository from "../../../hooks/repositories/notificationRepository";
import { isConnected } from "../networkStatus";
import { runNotificationSync, stopNotificationSyncRetries } from "../notificationSync";

const claimNextMutation = notificationRepository.claimNextMutation as jest.Mock;
const requeuePendingMutation = notificationRepository.requeuePendingMutation as jest.Mock;
const apiPost = api.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
  stopNotificationSyncRetries();
});

afterEach(() => {
  jest.useRealTimers();
});

const mutation = (payload: unknown, overrides: Partial<{ createdAt: number; attempts: number }> = {}) => ({
  payload,
  createdAt: overrides.createdAt ?? 1,
  attempts: overrides.attempts ?? 0,
});

describe("offline", () => {
  it("does nothing and never claims a mutation", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    await runNotificationSync();
    expect(claimNextMutation).not.toHaveBeenCalled();
  });
});

describe("markAll / markIds", () => {
  it("posts { all: true } for a markAll mutation and invalidates once the queue drains", async () => {
    claimNextMutation
      .mockReturnValueOnce(mutation({ op: "markAll" }))
      .mockReturnValueOnce(null);
    apiPost.mockResolvedValueOnce({});

    await runNotificationSync();

    expect(apiPost).toHaveBeenCalledWith("/myapi/notifications/read/", { all: true });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["notifications"] }),
    );
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["notifications", "unread-count"] }),
    );
  });

  it("posts { ids } for a markIds mutation", async () => {
    claimNextMutation
      .mockReturnValueOnce(mutation({ op: "markIds", ids: [1, 2, 3] }))
      .mockReturnValueOnce(null);
    apiPost.mockResolvedValueOnce({});

    await runNotificationSync();

    expect(apiPost).toHaveBeenCalledWith("/myapi/notifications/read/", { ids: [1, 2, 3] });
  });

  it("drains multiple queued mutations in one pass", async () => {
    claimNextMutation
      .mockReturnValueOnce(mutation({ op: "markIds", ids: [1] }))
      .mockReturnValueOnce(mutation({ op: "markIds", ids: [2] }, { createdAt: 2 }))
      .mockReturnValueOnce(null);
    apiPost.mockResolvedValue({});

    await runNotificationSync();

    expect(apiPost).toHaveBeenCalledTimes(2);
    // Invalidation happens once after the whole pass, not once per mutation.
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2);
  });
});

describe("failure handling", () => {
  it("on a network error: requeues the mutation, invalidates, and stops the pass early", async () => {
    claimNextMutation.mockReturnValueOnce(mutation({ op: "markAll" }));
    apiPost.mockRejectedValueOnce({ isNetworkError: true, message: "Network Error" });

    await runNotificationSync();

    expect(requeuePendingMutation).toHaveBeenCalledWith(
      expect.objectContaining({ op: "markAll" }),
      1,
      0,
    );
    expect(queryClient.invalidateQueries).toHaveBeenCalled();
    expect(claimNextMutation).toHaveBeenCalledTimes(1);
  });

  it("on a real (non-network) error: silently drops the mutation (no error UI queue) and continues", async () => {
    claimNextMutation
      .mockReturnValueOnce(mutation({ op: "markIds", ids: [1] }))
      .mockReturnValueOnce(mutation({ op: "markIds", ids: [2] }, { createdAt: 2 }))
      .mockReturnValueOnce(null);
    apiPost
      .mockRejectedValueOnce({ isNetworkError: false, isTimeout: false, message: "Stale id" })
      .mockResolvedValueOnce({});

    await runNotificationSync();

    expect(requeuePendingMutation).not.toHaveBeenCalled();
    expect(claimNextMutation).toHaveBeenCalledTimes(3);
    expect(apiPost).toHaveBeenCalledTimes(2);
  });
});

describe("stopNotificationSyncRetries", () => {
  it("cancels a scheduled backoff retry so it never fires", async () => {
    jest.useFakeTimers();
    claimNextMutation.mockReturnValueOnce(mutation({ op: "markAll" }));
    apiPost.mockRejectedValueOnce({ isNetworkError: true, message: "boom" });

    await runNotificationSync();
    expect(claimNextMutation).toHaveBeenCalledTimes(1);

    stopNotificationSyncRetries();
    jest.advanceTimersByTime(60_000);

    expect(claimNextMutation).toHaveBeenCalledTimes(1);
  });
});
