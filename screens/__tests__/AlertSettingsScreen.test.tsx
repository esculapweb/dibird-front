jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
  // AlertSettingsScreen imports util/helpers's isoToFlagEmoji directly (a
  // real, unmocked import) which transitively loads the real services/i18n
  // — its own i18n.use(initReactI18next).init(...) needs this stub once
  // react-i18next itself is mocked, same as NotificationsScreen.test.tsx.
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
  };
});
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn() },
}));
// RadiusRow (@react-native-community/slider) and TimeWindowRow (HourPicker)
// are separately-testable widgets unrelated to this screen's own
// orchestration — stub both down to a button that fires their one callback,
// same reasoning as ProfileForm in ProfileScreen.test.tsx.
jest.mock("../../components/ui/RadiusRow", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onSave }: { onSave: (v: number) => void }) => (
      <TouchableOpacity testID="radius-save" onPress={() => onSave(75)}>
        <Text>radius</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock("../../components/ui/TimeWindowRow", () => {
  const { View, TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    TimeWindowRow: ({ index, onChangeStart, onChangeEnd, onRemove }: {
      index: number;
      onChangeStart: (h: number) => void;
      onChangeEnd: (h: number) => void;
      onRemove: () => void;
    }) => (
      <View>
        <TouchableOpacity testID={`window-start-${index}`} onPress={() => onChangeStart(6)}>
          <Text>start</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`window-end-${index}`} onPress={() => onChangeEnd(20)}>
          <Text>end</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`window-remove-${index}`} onPress={onRemove}>
          <Text>remove</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});
jest.mock("../../store/alert-settings-context", () => ({
  useAlertSettings: jest.fn(),
}));
jest.mock("../../store/location-context", () => ({
  useLocation: jest.fn(),
}));
jest.mock("../../hooks/usePushNotifications", () => ({
  requestPushPermission: jest.fn(),
}));
jest.mock("../../hooks/usePushPermissionStatus", () => ({
  usePushPermissionStatus: () => ({
    status: mockPushStatus,
    request: mockRequestPush,
  }),
}));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { BottomSheet } from "../../services/bottomSheet";
import { useAlertSettings } from "../../store/alert-settings-context";
import { useLocation } from "../../store/location-context";
import { AlertSettings } from "../../services/alertSettings";
import { requestPushPermission } from "../../hooks/usePushNotifications";
import type { PushPermissionStatus } from "../../hooks/usePushPermissionStatus";
import { track } from "../../services/analytics";
import AlertSettingsScreen from "../AlertSettingsScreen";

const mockSave = jest.fn();
const mockRefresh = jest.fn();
const mockRequestLocation = jest.fn();
const mockGetPermissionStatus = jest.fn();
const mockRequestPush = jest.fn();

let mockPushStatus: PushPermissionStatus | null = "granted";

const SETTINGS: AlertSettings = {
  id: 1,
  location_lat: 10,
  location_lon: 20,
  territory_data: { code: "FR", id: 5, name: "France", segment: "" },
  radius_km: 250,
  rarity_threshold: "rare",
  language: "en",
  seen_mode: "year",
  watchlist_only: false,
  active_hours_utc: [],
  max_alerts_per_day: 5,
  is_enabled: true,
  updated_at: "2026-01-01T00:00:00Z",
};

const mockSettingsContext = (overrides: Record<string, unknown> = {}) => {
  (useAlertSettings as jest.Mock).mockReturnValue({
    settings: SETTINGS,
    loading: false,
    error: null,
    refresh: mockRefresh,
    save: mockSave,
    ...overrides,
  });
};

const mockLocationContext = (overrides: Record<string, unknown> = {}) => {
  (useLocation as jest.Mock).mockReturnValue({
    requestLocation: mockRequestLocation,
    isRequesting: false,
    permissionStatus: null,
    getPermissionStatus: mockGetPermissionStatus,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSave.mockResolvedValue(true);
  mockPushStatus = "granted";
  mockSettingsContext();
  mockLocationContext();
});

// The switch says "on" off the backend's `is_enabled`, which knows nothing about
// the OS: after a reinstall (the permission is reset, the session is not) the
// screen was showing alerts as working while every notification was being
// dropped. Reaching the permission from here is the point — the row is the only
// thing on this screen that can.
describe("notifications blocked by the OS", () => {
  it("stays hidden while the permission is granted", async () => {
    await render(<AlertSettingsScreen />);

    expect(screen.queryByTestId("alert-push-blocked")).not.toBeOnTheScreen();
  });

  it("stays hidden while the alerts themselves are off", async () => {
    mockPushStatus = "denied";
    mockSettingsContext({ settings: { ...SETTINGS, is_enabled: false } });
    await render(<AlertSettingsScreen />);

    expect(screen.queryByTestId("alert-push-blocked")).not.toBeOnTheScreen();
  });

  // Null is "not read yet" and "a simulator, where push cannot work at all".
  it("stays hidden while the status is unknown", async () => {
    mockPushStatus = null;
    await render(<AlertSettingsScreen />);

    expect(screen.queryByTestId("alert-push-blocked")).not.toBeOnTheScreen();
  });

  it.each([
    ["denied", "open_settings"],
    ["undetermined", "alerts_card_allow"],
  ] as const)("offers %s the %s action", async (status, label) => {
    mockPushStatus = status;
    await render(<AlertSettingsScreen />);

    expect(screen.getByTestId("alert-push-blocked")).toBeOnTheScreen();
    expect(screen.getByText(label)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("alert-push-blocked-action"));
    expect(mockRequestPush).toHaveBeenCalledTimes(1);
  });
});

it("shows a loading overlay while settings haven't loaded yet", async () => {
  mockSettingsContext({ settings: null, loading: true });
  await render(<AlertSettingsScreen />);
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});

it("shows an error overlay with retry when there's an error and no cached settings", async () => {
  mockSettingsContext({ settings: null, error: "network down" });
  await render(<AlertSettingsScreen />);

  expect(screen.getByText("alert_settings_unavailable")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("try_again"));
  expect(mockRefresh).toHaveBeenCalledTimes(1);
});

it("does not error out and keeps rendering cached settings when there's an error but settings are cached", async () => {
  mockSettingsContext({ error: "stale data warning" });
  await render(<AlertSettingsScreen />);
  expect(screen.queryByText("alert_settings_unavailable")).not.toBeOnTheScreen();
  expect(screen.getByRole("switch")).toBeOnTheScreen();
});

describe("save() call sites", () => {
  it("toggling the enable switch saves is_enabled", async () => {
    await render(<AlertSettingsScreen />);
    await fireEvent(screen.getByRole("switch"), "valueChange", false);
    expect(mockSave).toHaveBeenCalledWith({ is_enabled: false });
  });

  it("selecting 'all' vs 'watchlist only' saves watchlist_only", async () => {
    await render(<AlertSettingsScreen />);
    await fireEvent.press(screen.getByText("alert_watchlist_only"));
    expect(mockSave).toHaveBeenCalledWith({ watchlist_only: true });

    mockSave.mockClear();
    mockSettingsContext({ settings: { ...SETTINGS, watchlist_only: true } });
    await render(<AlertSettingsScreen />);
    await fireEvent.press(screen.getAllByText("alert_filter_all").at(-1)!);
    expect(mockSave).toHaveBeenCalledWith({ watchlist_only: false });
  });

  it("picking a seen-mode option only renders and acts when watchlist_only is true", async () => {
    await render(<AlertSettingsScreen />);
    expect(screen.queryByText("alert_seen_mode_alltime")).not.toBeOnTheScreen();

    mockSettingsContext({ settings: { ...SETTINGS, watchlist_only: true } });
    await render(<AlertSettingsScreen />);
    await fireEvent.press(screen.getAllByText("alert_seen_mode_alltime").at(-1)!);
    expect(mockSave).toHaveBeenCalledWith({ seen_mode: "alltime" });
  });

  it("the max-alerts-per-day stepper saves the snapped value", async () => {
    await render(<AlertSettingsScreen />);
    await fireEvent.press(screen.getByText("+"));
    expect(mockSave).toHaveBeenCalledWith({ max_alerts_per_day: 10 });

    mockSave.mockClear();
    await fireEvent.press(screen.getByText("−"));
    expect(mockSave).toHaveBeenCalledWith({ max_alerts_per_day: 1 });
  });

  it("the radius row saves its value on onSave", async () => {
    await render(<AlertSettingsScreen />);
    await fireEvent.press(screen.getByTestId("radius-save"));
    expect(mockSave).toHaveBeenCalledWith({ radius_km: 75 });
  });
});

describe("location permission handling", () => {
  it("denied permission shows the location-unavailable sheet instead of requesting location, and does not crash", async () => {
    mockLocationContext({ permissionStatus: "denied" });
    await render(<AlertSettingsScreen />);

    await fireEvent.press(screen.getByText("alert_locate_me"));

    expect(mockRequestLocation).not.toHaveBeenCalled();
    expect(BottomSheet.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "location_unavailable" }),
    );
  });

  it("a successful location request saves the rounded lat/lon with sync:true", async () => {
    mockRequestLocation.mockResolvedValue({ coords: [2.35, 48.86], accuracy: 5 });
    await render(<AlertSettingsScreen />);

    await fireEvent.press(screen.getByText("alert_locate_me"));

    expect(mockSave).toHaveBeenCalledWith({ lat: 48.86, lon: 2.35 }, true);
  });

  // The first refusal: on the render the permission is still "never asked", the
  // "denied" status only appears in the request itself. It has to be read from the
  // provider (`getPermissionStatus`) rather than from the state of this render —
  // otherwise the hint only arrived on the second tap.
  it("shows the unavailable sheet on the very first refusal", async () => {
    mockRequestLocation.mockResolvedValue(null);
    mockGetPermissionStatus.mockReturnValue("denied");

    await render(<AlertSettingsScreen />);
    await fireEvent.press(screen.getByText("alert_locate_me"));

    expect(mockRequestLocation).toHaveBeenCalledTimes(1);
    expect(BottomSheet.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: "location_unavailable" }),
    );
  });

  // A fix may fail to arrive without any refusal — GPS indoors, a timeout. There
  // is no point pushing the user into the system settings in that case.
  it("stays quiet when the fix simply did not arrive", async () => {
    mockRequestLocation.mockResolvedValue(null);
    mockGetPermissionStatus.mockReturnValue("granted");

    await render(<AlertSettingsScreen />);
    await fireEvent.press(screen.getByText("alert_locate_me"));

    expect(BottomSheet.show).not.toHaveBeenCalled();
  });
});

describe("time windows", () => {
  it("shows the empty-schedule message and an add button when there are no windows", async () => {
    await render(<AlertSettingsScreen />);
    expect(screen.getByText("alert_schedule_empty")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("alert_add_window"));
    expect(mockSave).toHaveBeenCalledWith({ active_hours_utc: [[8, 22]] });
  });

  it("editing a window's start/end saves the updated window in place", async () => {
    mockSettingsContext({ settings: { ...SETTINGS, active_hours_utc: [[9, 21]] } });
    await render(<AlertSettingsScreen />);

    await fireEvent.press(screen.getByTestId("window-start-0"));
    expect(mockSave).toHaveBeenCalledWith({ active_hours_utc: [[6, 21]] });

    // The screen keeps its own localWindows state seeded from settings and
    // edits it in place — the second edit builds on the first's result
    // ([6, 21]), not the original prop value, since local state persists
    // across these two presses within the same mount.
    mockSave.mockClear();
    await fireEvent.press(screen.getByTestId("window-end-0"));
    expect(mockSave).toHaveBeenCalledWith({ active_hours_utc: [[6, 20]] });
  });

  it("removing a window saves the list without it", async () => {
    mockSettingsContext({
      settings: { ...SETTINGS, active_hours_utc: [[9, 21], [1, 5]] },
    });
    await render(<AlertSettingsScreen />);

    await fireEvent.press(screen.getByTestId("window-remove-0"));

    expect(mockSave).toHaveBeenCalledWith({ active_hours_utc: [[1, 5]] });
  });
});

// Turning the alerts on is the only moment on this screen when push is really
// needed, so the system dialog is asked for here rather than on signing in.
describe("enabling alerts", () => {
  beforeEach(() => {
    mockSettingsContext({ settings: { ...SETTINGS, is_enabled: false } });
    (requestPushPermission as jest.Mock).mockResolvedValue(true);
  });

  it("asks for push permission and reports the source", async () => {
    await render(<AlertSettingsScreen />);
    await fireEvent(screen.getByRole("switch"), "valueChange", true);

    expect(requestPushPermission).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("alerts_enabled", {
      source: "settings",
    });
    expect(mockSave).toHaveBeenCalledWith({ is_enabled: true });
  });

  // A refusal does not cancel the enable: the settings stay, and notifications
  // will flow as soon as the permission is granted in the system settings.
  it("saves the setting even when permission was refused", async () => {
    (requestPushPermission as jest.Mock).mockResolvedValue(false);

    await render(<AlertSettingsScreen />);
    await fireEvent(screen.getByRole("switch"), "valueChange", true);

    expect(mockSave).toHaveBeenCalledWith({ is_enabled: true });
  });

  it("does not prompt when switching alerts off", async () => {
    mockSettingsContext();

    await render(<AlertSettingsScreen />);
    await fireEvent(screen.getByRole("switch"), "valueChange", false);

    expect(requestPushPermission).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalledWith({ is_enabled: false });
  });
});
