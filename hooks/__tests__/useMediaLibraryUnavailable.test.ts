jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../services/bottomSheet", () => ({ BottomSheet: { show: jest.fn() } }));

import { Linking, Platform } from "react-native";
import { renderHook } from "@testing-library/react-native";
import { BottomSheet } from "../../services/bottomSheet";
import { useMediaLibraryUnavailable } from "../useMediaLibraryUnavailable";

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("shows a permission-denied confirm sheet", async () => {
  const { result } = await renderHook(() => useMediaLibraryUnavailable());
  result.current();

  expect(BottomSheet.show).toHaveBeenCalledWith(
    expect.objectContaining({
      title: "permission_denied",
      description: "allow_access_photo",
      confirmText: "open_settings",
      cancelText: "cancel",
    }),
  );
});

describe("onConfirm", () => {
  const confirmedOnConfirm = async () => {
    const { result } = await renderHook(() => useMediaLibraryUnavailable());
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
