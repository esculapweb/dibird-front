jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children, bottom }: {
      children: import("react").ReactNode;
      bottom?: import("react").ReactNode;
    }) => (
      <View>
        {children}
        {bottom}
      </View>
    ),
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("../../store/profile-context", () => ({ useProfile: jest.fn() }));
jest.mock("../../store/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("../../store/onboarding-context", () => ({ useOnboarding: jest.fn() }));
jest.mock("../../hooks/Profile/useExportProfile", () => ({ useExportProfile: jest.fn() }));
jest.mock("../../hooks/useBiometricSetting", () => ({ useBiometricSetting: jest.fn() }));
jest.mock("../../services/bio", () => ({ canUseBiometrics: jest.fn() }));
jest.mock("../../util/openSupportEmail", () => ({ openSupportEmail: jest.fn() }));
jest.mock("../../util/openDonatePage", () => ({ openDonatePage: jest.fn() }));
jest.mock("../../services/bottomSheet", () => ({ BottomSheet: { show: jest.fn(), hide: jest.fn() } }));
jest.mock("../../util/fetches", () => ({ deleteMyProfile: jest.fn() }));
jest.mock("../../hooks/useApiError", () => ({ useApiError: () => ({ showErrorToast: mockShowErrorToast }) }));
jest.mock("../../util/helpers", () => ({
  ...jest.requireActual("../../util/helpers"),
  getFullVersion: () => "1.0.0 (42)",
}));
jest.mock("../../services/api", () => ({ post: jest.fn() }));
jest.mock("../../services/errors", () => ({ logError: jest.fn() }));

import { Share, Platform, Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useProfile } from "../../store/profile-context";
import { useAuth } from "../../store/auth-context";
import { useOnboarding } from "../../store/onboarding-context";
import { useExportProfile } from "../../hooks/Profile/useExportProfile";
import { useBiometricSetting } from "../../hooks/useBiometricSetting";
import { canUseBiometrics } from "../../services/bio";
import { openSupportEmail } from "../../util/openSupportEmail";
import { openDonatePage } from "../../util/openDonatePage";
import { BottomSheet } from "../../services/bottomSheet";
import { deleteMyProfile } from "../../util/fetches";
import api from "../../services/api";
import { logError } from "../../services/errors";
import { createNavigationMock } from "../test-utils";
import SettingsScreen from "../SettingsScreen";

const mockShowErrorToast = jest.fn();
const mockNavigation = createNavigationMock();
const mockLogout = jest.fn();
const mockToggleBiometric = jest.fn();
const mockTriggerExport = jest.fn();
const mockCleanup = jest.fn();
const mockRestartOnboarding = jest.fn();
const originalOS = Platform.OS;

const mockOnboarding = (status = "done") => {
  (useOnboarding as jest.Mock).mockReturnValue({
    status,
    restart: mockRestartOnboarding,
  });
};

const mockProfileCtx = (overrides: Record<string, unknown> = {}) => {
  (useProfile as jest.Mock).mockReturnValue({
    profile: { user: 42, user_data: { email: "user@example.com" } },
    ...overrides,
  });
};

const mockExport = (overrides: Record<string, unknown> = {}) => {
  (useExportProfile as jest.Mock).mockReturnValue({
    state: "idle",
    triggerExport: mockTriggerExport,
    cleanup: mockCleanup,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
  mockProfileCtx();
  (useAuth as jest.Mock).mockReturnValue({ logout: mockLogout });
  (useBiometricSetting as jest.Mock).mockReturnValue({
    isEnabled: false,
    isLoading: false,
    toggle: mockToggleBiometric,
  });
  (canUseBiometrics as jest.Mock).mockResolvedValue(false);
  mockExport();
  mockOnboarding();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("renders the always-present rows, including the app version", async () => {
  await render(<SettingsScreen />);
  expect(screen.getByText("alert_settings")).toBeOnTheScreen();
  expect(screen.getByText("export_data")).toBeOnTheScreen();
  expect(screen.getByText("import_data")).toBeOnTheScreen();
  expect(screen.getByText("settings_tell_a_friend")).toBeOnTheScreen();
  expect(screen.getByText("settings_send_feedback")).toBeOnTheScreen();
  expect(screen.getByText("privacy_policy")).toBeOnTheScreen();
  expect(screen.getByText("terms_of_service")).toBeOnTheScreen();
  expect(screen.getByText("delete_profile")).toBeOnTheScreen();
  expect(screen.getByText('app_version:{"version":"1.0.0 (42)"}')).toBeOnTheScreen();
});

it("cleans up the export poller on unmount", async () => {
  const { unmount } = await render(<SettingsScreen />);
  await unmount();
  expect(mockCleanup).toHaveBeenCalledTimes(1);
});

describe("test push row", () => {
  it("is hidden for a regular profile", async () => {
    mockProfileCtx({ profile: { user: 42, user_data: {} } });
    await render(<SettingsScreen />);
    expect(screen.queryByText("Send test push")).not.toBeOnTheScreen();
  });

  it.each([9386, 1])("is shown for the app-review profile (user %d) and sends a push on success", async (userId) => {
    mockProfileCtx({ profile: { user: userId, user_data: {} } });
    (api.post as jest.Mock).mockResolvedValue({});
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByText("Send test push"));
    expect(api.post).toHaveBeenCalledWith("/myapi/notifications/test-push/");
    await Promise.resolve();
    expect(Alert.alert).toHaveBeenCalledWith("OK", "Push sent");
  });

  it("shows an error alert and logs when the test push fails", async () => {
    mockProfileCtx({ profile: { user: 1, user_data: {} } });
    (api.post as jest.Mock).mockRejectedValue(new Error("network down"));
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByText("Send test push"));
    await Promise.resolve();
    await Promise.resolve();
    expect(logError).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Error", "Could not send push");
  });
});

describe("replay onboarding row", () => {
  it("is hidden for a regular profile", async () => {
    mockProfileCtx({ profile: { user: 42, user_data: {} } });
    await render(<SettingsScreen />);
    expect(screen.queryByText("Replay onboarding")).not.toBeOnTheScreen();
  });

  it.each([9386, 1])("puts the flow back for the debug profile (user %d)", async (userId) => {
    mockProfileCtx({ profile: { user: userId, user_data: {} } });
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByText("Replay onboarding"));
    expect(mockRestartOnboarding).toHaveBeenCalledTimes(1);
  });

  // restart() only returns the screen into the navigator — the route is added
  // before the current one rather than on top of it, so without this navigation
  // the tap would look like "nothing happened".
  it("navigates to the screen once the status has flipped", async () => {
    mockProfileCtx({ profile: { user: 1, user_data: {} } });
    mockOnboarding("needed");
    await render(<SettingsScreen />);

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Onboarding");
  });

  it("leaves a regular profile alone even if the status says needed", async () => {
    mockProfileCtx({ profile: { user: 42, user_data: {} } });
    mockOnboarding("needed");
    await render(<SettingsScreen />);

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});

describe("biometric section", () => {
  it("is hidden entirely when biometrics aren't available on the device", async () => {
    (canUseBiometrics as jest.Mock).mockResolvedValue(false);
    await render(<SettingsScreen />);
    expect(screen.queryByText("settings_biometric_lock")).not.toBeOnTheScreen();
  });

  it("shows the toggle once availability resolves, wired to toggleBiometric", async () => {
    (canUseBiometrics as jest.Mock).mockResolvedValue(true);
    await render(<SettingsScreen />);

    await screen.findByText("settings_biometric_lock");
    await fireEvent(screen.getByRole("switch"), "valueChange", true);
    expect(mockToggleBiometric).toHaveBeenCalledWith(true);
  });

  it("disables the toggle while the biometric setting is still loading", async () => {
    (canUseBiometrics as jest.Mock).mockResolvedValue(true);
    (useBiometricSetting as jest.Mock).mockReturnValue({
      isEnabled: false,
      isLoading: true,
      toggle: mockToggleBiometric,
    });
    await render(<SettingsScreen />);

    await screen.findByText("settings_biometric_lock");
    expect(screen.getByRole("switch").props.disabled).toBe(true);
  });
});

describe("export data row", () => {
  it("shows in-progress / done / failed labels and disables the row while exporting", async () => {
    mockExport({ state: "pending" });
    await render(<SettingsScreen />);
    expect(screen.getByText("export_data_in_progress")).toBeOnTheScreen();

    mockExport({ state: "completed" });
    await render(<SettingsScreen />);
    expect(screen.getByText("export_data_done")).toBeOnTheScreen();

    mockExport({ state: "failed" });
    await render(<SettingsScreen />);
    expect(screen.getByText("export_data_failed")).toBeOnTheScreen();
  });

  it("opens a confirm sheet that triggers the export on confirm", async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByText("export_data"));

    expect(BottomSheet.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "export_data" }),
    );
    const { onConfirm } = (BottomSheet.show as jest.Mock).mock.calls[0][0];
    onConfirm();
    expect(mockTriggerExport).toHaveBeenCalledTimes(1);
  });
});

it("tells a friend with a platform-appropriate share payload", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
  Platform.OS = "ios";
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByText("settings_tell_a_friend"));
  expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("http") }));

  shareSpy.mockClear();
  Platform.OS = "android";
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByText("settings_tell_a_friend"));
  expect(shareSpy).toHaveBeenCalledWith({ message: "tell_a_friend_message" });
});

it("send feedback opens the support email composer", async () => {
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByText("settings_send_feedback"));
  expect(openSupportEmail).toHaveBeenCalledTimes(1);
});

it("support the project opens the donation page with the settings source", async () => {
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByText("settings_support_project"));
  expect(openDonatePage).toHaveBeenCalledWith("settings");
});

it("navigates to Privacy and Terms", async () => {
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByText("privacy_policy"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("Privacy");
  await fireEvent.press(screen.getByText("terms_of_service"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("Terms");
});

it("navigates to AlertSettings", async () => {
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByText("alert_settings"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("AlertSettings");
});

describe("delete profile", () => {
  it("opens a danger confirm sheet requiring the user's email", async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByText("delete_profile"));

    expect(BottomSheet.show).toHaveBeenCalledWith(
      expect.objectContaining({
        danger: true,
        requiredInput: "user@example.com",
        inputPlaceholder: "user@example.com",
      }),
    );
  });

  it("logs out only when deletion actually succeeds (204)", async () => {
    (deleteMyProfile as jest.Mock).mockResolvedValue(204);
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByText("delete_profile"));

    const { onConfirm } = (BottomSheet.show as jest.Mock).mock.calls[0][0];
    await onConfirm();
    expect(deleteMyProfile).toHaveBeenCalledWith("user@example.com");
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  // A regular dismiss() after onConfirm would land on the tick in which the
  // navigator swaps AppStack for AuthStack, and the closing animation got lost —
  // the sheet stayed above Welcome.
  it("closes the sheet before tearing down the session", async () => {
    (deleteMyProfile as jest.Mock).mockResolvedValue(204);
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByText("delete_profile"));

    const { onConfirm } = (BottomSheet.show as jest.Mock).mock.calls[0][0];
    await onConfirm();

    expect(BottomSheet.hide).toHaveBeenCalledTimes(1);
    expect((BottomSheet.hide as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      mockLogout.mock.invocationCallOrder[0],
    );
  });

  it("does not log out when deletion doesn't return 204", async () => {
    (deleteMyProfile as jest.Mock).mockResolvedValue(200);
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByText("delete_profile"));

    const { onConfirm } = (BottomSheet.show as jest.Mock).mock.calls[0][0];
    await onConfirm();
    expect(mockLogout).not.toHaveBeenCalled();
    // The sheet stays open: there would be nowhere to show the error if it closed.
    expect(BottomSheet.hide).not.toHaveBeenCalled();
  });

  it("routes deletion errors through showErrorToast with a field-aware extractor", async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByText("delete_profile"));

    const { onError } = (BottomSheet.show as jest.Mock).mock.calls[0][0];
    onError({ response: { data: { detail: "server said no" } } });
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      { response: { data: { detail: "server said no" } } },
      "deleteMyProfile",
      expect.any(Function),
    );
    const extractor = mockShowErrorToast.mock.calls[0][2];
    expect(extractor({ response: { data: { detail: "server said no" } } })).toEqual({
      title: "delete_failed",
      message: "server said no",
    });
    expect(extractor({})).toEqual({
      title: "delete_failed",
      message: "could_not_delete_profile",
    });
  });
});
