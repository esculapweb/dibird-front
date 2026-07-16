jest.mock("../api", () => ({ get: jest.fn(), patch: jest.fn() }));

import api from "../api";
import { getAlertSettings, updateAlertSettings } from "../alertSettings";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getAlertSettings", () => {
  it("fetches the current user's alert settings", () => {
    getAlertSettings();
    expect(api.get).toHaveBeenCalledWith("/myapi/alert-settings/me/");
  });
});

describe("updateAlertSettings", () => {
  it("PATCHes without the sync query param by default", () => {
    updateAlertSettings({ radius_km: 25 });
    expect(api.patch).toHaveBeenCalledWith("/myapi/alert-settings/me/", { radius_km: 25 });
  });

  it("appends ?sync=1 when sync is requested", () => {
    updateAlertSettings({ radius_km: 25 }, true);
    expect(api.patch).toHaveBeenCalledWith("/myapi/alert-settings/me/?sync=1", { radius_km: 25 });
  });
});
