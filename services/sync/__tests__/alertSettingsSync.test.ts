jest.mock("../../alertSettings", () => ({
  getAlertSettings: jest.fn(),
  updateAlertSettings: jest.fn(),
}));
jest.mock("../../../hooks/repositories/alertSettingsRepository", () => ({
  getPendingMutations: jest.fn(() => []),
  failMutation: jest.fn(),
  resolveMutation: jest.fn(),
  upsertFromServer: jest.fn(),
}));
jest.mock("../networkStatus", () => ({
  isConnected: jest.fn(() => true),
}));

import { getAlertSettings, updateAlertSettings } from "../../alertSettings";
import * as alertSettingsRepository from "../../../hooks/repositories/alertSettingsRepository";
import { isConnected } from "../networkStatus";
import { pullAlertSettings, pushPending, runAlertSettingsSync } from "../alertSettingsSync";

const getPendingMutations = alertSettingsRepository.getPendingMutations as jest.Mock;
const resolveMutation = alertSettingsRepository.resolveMutation as jest.Mock;
const failMutation = alertSettingsRepository.failMutation as jest.Mock;
const upsertFromServer = alertSettingsRepository.upsertFromServer as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (isConnected as jest.Mock).mockReturnValue(true);
  getPendingMutations.mockReturnValue([]);
});

describe("pushPending", () => {
  it("does nothing while offline", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    getPendingMutations.mockReturnValue([{ id: 1, payload: { patch: { radius_km: 5 }, sync: false } }]);

    await pushPending();

    expect(updateAlertSettings).not.toHaveBeenCalled();
  });

  it("pushes every pending mutation in order, upserting and resolving each one", async () => {
    getPendingMutations.mockReturnValue([
      { id: 1, payload: { patch: { radius_km: 5 }, sync: false } },
      { id: 2, payload: { patch: { is_enabled: true }, sync: true } },
    ]);
    (updateAlertSettings as jest.Mock)
      .mockResolvedValueOnce({ data: { id: 1, radius_km: 5 } })
      .mockResolvedValueOnce({ data: { id: 1, is_enabled: true } });

    await pushPending();

    expect(updateAlertSettings).toHaveBeenNthCalledWith(1, { radius_km: 5 }, false);
    expect(updateAlertSettings).toHaveBeenNthCalledWith(2, { is_enabled: true }, true);
    expect(upsertFromServer).toHaveBeenCalledTimes(2);
    expect(resolveMutation).toHaveBeenNthCalledWith(1, 1);
    expect(resolveMutation).toHaveBeenNthCalledWith(2, 2);
  });

  it("on a network error: stops the loop without failing the mutation or throwing", async () => {
    getPendingMutations.mockReturnValue([
      { id: 1, payload: { patch: { radius_km: 5 }, sync: false } },
      { id: 2, payload: { patch: { is_enabled: true }, sync: false } },
    ]);
    (updateAlertSettings as jest.Mock).mockRejectedValueOnce({
      isNetworkError: true,
      message: "Network Error",
    });

    await expect(pushPending()).resolves.toBeUndefined();

    expect(updateAlertSettings).toHaveBeenCalledTimes(1);
    expect(failMutation).not.toHaveBeenCalled();
    expect(resolveMutation).not.toHaveBeenCalled();
  });

  it("on a real (non-network) error: fails the mutation and rethrows", async () => {
    getPendingMutations.mockReturnValue([{ id: 1, payload: { patch: { radius_km: 5 }, sync: false } }]);
    (updateAlertSettings as jest.Mock).mockRejectedValueOnce({
      isNetworkError: false,
      isTimeout: false,
      message: "Validation error",
    });

    await expect(pushPending()).rejects.toMatchObject({ message: "Validation error" });

    expect(failMutation).toHaveBeenCalledWith(1, "Validation error");
  });
});

describe("pullAlertSettings", () => {
  it("does nothing while offline", async () => {
    (isConnected as jest.Mock).mockReturnValue(false);
    await pullAlertSettings();
    expect(getAlertSettings).not.toHaveBeenCalled();
  });

  it("skips the pull if a local edit is still pending, to avoid clobbering it", async () => {
    getPendingMutations.mockReturnValue([{ id: 1, payload: { patch: {}, sync: false } }]);
    await pullAlertSettings();
    expect(getAlertSettings).not.toHaveBeenCalled();
  });

  it("fetches and upserts when online with nothing pending", async () => {
    (getAlertSettings as jest.Mock).mockResolvedValueOnce({ data: { id: 1 } });
    await pullAlertSettings();
    expect(upsertFromServer).toHaveBeenCalledWith({ id: 1 });
  });
});

describe("runAlertSettingsSync", () => {
  it("pushes pending edits then pulls the latest settings", async () => {
    getPendingMutations.mockReturnValue([]);
    (getAlertSettings as jest.Mock).mockResolvedValueOnce({ data: { id: 1 } });

    await runAlertSettingsSync();

    expect(getAlertSettings).toHaveBeenCalled();
  });

  it("propagates a real push error and skips the pull entirely", async () => {
    getPendingMutations.mockReturnValue([{ id: 1, payload: { patch: { radius_km: 5 }, sync: false } }]);
    (updateAlertSettings as jest.Mock).mockRejectedValueOnce({
      isNetworkError: false,
      isTimeout: false,
      message: "Validation error",
    });

    await expect(runAlertSettingsSync()).rejects.toMatchObject({ message: "Validation error" });

    expect(getAlertSettings).not.toHaveBeenCalled();
  });

  it("swallows a pull failure as best-effort after a successful push", async () => {
    getPendingMutations.mockReturnValue([]);
    (getAlertSettings as jest.Mock).mockRejectedValueOnce(new Error("boom"));

    await expect(runAlertSettingsSync()).resolves.toBeUndefined();
  });
});
