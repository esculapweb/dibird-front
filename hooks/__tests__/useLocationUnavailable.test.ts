jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../services/bottomSheet", () => ({ BottomSheet: { show: jest.fn() } }));

import { Linking, Platform } from "react-native";
import { renderHook } from "@testing-library/react-native";
import { BottomSheet } from "../../services/bottomSheet";
import { useLocationUnavailable } from "../useLocationUnavailable";

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("shows a location-unavailable confirm sheet with the default hint", async () => {
  const { result } = await renderHook(() => useLocationUnavailable());
  result.current();

  expect(BottomSheet.show).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "location_unavailable",
      description: "location_unavailable_hint",
      confirmText: "open_settings",
      cancelText: "cancel",
    }),
  );
});

it("prefers a caller-supplied description over the default hint", async () => {
  const { result } = await renderHook(() =>
    useLocationUnavailable("place_needs_location"),
  );
  result.current();

  expect(BottomSheet.show).toHaveBeenCalledWith(
    expect.objectContaining({ description: "place_needs_location" }),
  );
});

describe("onConfirm", () => {
  const confirmedOnConfirm = async () => {
    const { result } = await renderHook(() => useLocationUnavailable());
    result.current();
    const payload = (BottomSheet.show as jest.Mock).mock.calls[0][0];
    payload.onConfirm();
  };

  it("opens the app-specific settings URL on iOS", async () => {
    Platform.OS = "ios";
    await confirmedOnConfirm();
    expect(Linking.openURL).toHaveBeenCalledWith("app-settings:");
    expect(Linking.openSettings).not.toHaveBeenCalled();
  });

  it("opens the generic app settings on Android", async () => {
    Platform.OS = "android";
    await confirmedOnConfirm();
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });
});
