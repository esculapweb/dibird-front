jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("../../../store/alert-settings-context", () => ({
  useAlertSettings: () => ({ settings: mockSettings, save: mockSave }),
}));
jest.mock("../../../store/location-context", () => ({
  useLocation: () => ({
    requestLocation: mockRequestLocation,
    getPermissionStatus: mockGetPermissionStatus,
  }),
}));
jest.mock("../../../hooks/useLocationUnavailable", () => ({
  useLocationUnavailable: () => mockLocationUnavailable,
}));
jest.mock("../../../hooks/usePushNotifications", () => ({
  requestPushPermission: jest.fn(),
}));
jest.mock("../../../hooks/usePushPermissionStatus", () => ({
  usePushPermissionStatus: () => ({
    status: mockPushStatus,
    request: mockRequestPush,
  }),
}));
jest.mock("../../../services/analytics", () => ({ track: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";

import { createNavigationMock } from "../../../screens/test-utils";
import type { PushPermissionStatus } from "../../../hooks/usePushPermissionStatus";
import { requestPushPermission } from "../../../hooks/usePushNotifications";
import { track } from "../../../services/analytics";
import AlertsCard from "../AlertsCard";

const mockNavigation = createNavigationMock();
const mockSave = jest.fn();
const mockRequestLocation = jest.fn();
const mockGetPermissionStatus = jest.fn();
const mockLocationUnavailable = jest.fn();
const mockRequestPush = jest.fn();
const mockRequestPushPermission = requestPushPermission as jest.Mock;

let mockSettings: {
  is_enabled: boolean;
  location_lat: number | null;
} | null = null;
let mockPushStatus: PushPermissionStatus | null = "granted";

beforeEach(() => {
  jest.clearAllMocks();
  // The location is already there: in these tests the card is raised by alerts
  // being off.
  mockSettings = { is_enabled: false, location_lat: 48.85 };
  mockPushStatus = "granted";
  mockSave.mockResolvedValue(true);
  mockRequestLocation.mockResolvedValue(null);
  mockGetPermissionStatus.mockReturnValue("granted");
  mockRequestPushPermission.mockResolvedValue(true);
});

describe("visibility", () => {
  it("shows up while alerts are off", async () => {
    await render(<AlertsCard />);

    expect(screen.getByTestId("alerts-card")).toBeOnTheScreen();
  });

  it("disappears once alerts are on and the location is known", async () => {
    mockSettings = { is_enabled: true, location_lat: 48.85 };
    await render(<AlertsCard />);

    expect(screen.queryByTestId("alerts-card")).not.toBeOnTheScreen();
  });

  // The main newcomer case: alerts are on by default on the backend, so the card
  // never showed up on `is_enabled` alone — and there is no location, so
  // "nearby" means "anywhere".
  it("shows up with alerts on but no location, asking where to look", async () => {
    mockSettings = { is_enabled: true, location_lat: null };
    await render(<AlertsCard />);

    expect(screen.getByTestId("alerts-card")).toBeOnTheScreen();
    expect(screen.getByText("alerts_card_where_title")).toBeOnTheScreen();
    expect(screen.getByText("alerts_card_locate")).toBeOnTheScreen();
  });

  // Until the settings have arrived (or while the user is signed out) the state
  // is unknown — flashing the card in the meantime is not an option.
  it("stays away while the settings are unknown", async () => {
    mockSettings = null;
    await render(<AlertsCard />);

    expect(screen.queryByTestId("alerts-card")).not.toBeOnTheScreen();
  });

  // The dead end this variant exists for: after a reinstall the OS permission is
  // gone while the session is not, and with the alerts on the card was the one
  // thing that could have asked for it — and it did not show up.
  it("shows up with alerts on but the notifications blocked by the OS", async () => {
    mockSettings = { is_enabled: true, location_lat: 48.85 };
    mockPushStatus = "denied";
    await render(<AlertsCard />);

    expect(screen.getByText("alerts_card_blocked_title")).toBeOnTheScreen();
    expect(screen.getByText("open_settings")).toBeOnTheScreen();
  });

  it("offers to grant a permission that was never asked for", async () => {
    mockSettings = { is_enabled: true, location_lat: 48.85 };
    mockPushStatus = "undetermined";
    await render(<AlertsCard />);

    expect(screen.getByText("alerts_card_blocked_title")).toBeOnTheScreen();
    expect(screen.getByText("alerts_card_allow")).toBeOnTheScreen();
  });

  // Null is "not read yet" and "a simulator, where push cannot work at all" —
  // neither is a reason to announce that the notifications are blocked.
  it("stays away while the permission status is unknown", async () => {
    mockSettings = { is_enabled: true, location_lat: 48.85 };
    mockPushStatus = null;
    await render(<AlertsCard />);

    expect(screen.queryByTestId("alerts-card")).not.toBeOnTheScreen();
  });

  // Alerts off comes first: its own button asks for the permission anyway.
  it("keeps the enable copy when the alerts are off as well", async () => {
    mockPushStatus = "denied";
    await render(<AlertsCard />);

    expect(screen.getByText("alerts_card_title")).toBeOnTheScreen();
  });
});

describe("blocked notifications", () => {
  beforeEach(() => {
    mockSettings = { is_enabled: true, location_lat: 48.85 };
  });

  // Whether that ends in a dialog or in the system settings is the hook's call
  // (see usePushPermissionStatus) — the same button lives in the alert settings.
  it.each(["undetermined", "denied"] as const)(
    "hands a %s permission over to the hook",
    async (status) => {
      mockPushStatus = status;
      await render(<AlertsCard />);

      await fireEvent.press(screen.getByTestId("alerts-card-enable"));

      expect(mockRequestPush).toHaveBeenCalledTimes(1);
      // Nothing to save: the alerts are on already, it is the OS that says no.
      expect(mockSave).not.toHaveBeenCalled();
      expect(mockRequestPushPermission).not.toHaveBeenCalled();
    },
  );
});

describe("turning alerts on", () => {
  it("asks for push permission here, where the user has a reason to grant it", async () => {
    await render(<AlertsCard />);

    await fireEvent.press(screen.getByTestId("alerts-card-enable"));

    expect(mockRequestPushPermission).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith({ is_enabled: true });
    expect(track).toHaveBeenCalledWith("alerts_enabled", {
      source: "main_card",
    });
  });

  it("stores the coordinates when the location request produced a fix", async () => {
    mockRequestLocation.mockResolvedValue({
      coords: [2.3488, 48.8534],
      accuracy: 10,
    });

    await render(<AlertsCard />);
    await fireEvent.press(screen.getByTestId("alerts-card-enable"));

    // sync: without it a deferred task resolves the country from the coordinates,
    // and the label of "rare nearby" would stay as it was until a restart.
    expect(mockSave).toHaveBeenCalledWith({ lat: 48.85, lon: 2.35 }, true);
    expect(mockSave).toHaveBeenCalledWith({ is_enabled: true });
  });

  it("points at the OS settings when the location was refused", async () => {
    mockRequestLocation.mockResolvedValue(null);
    mockGetPermissionStatus.mockReturnValue("denied");

    await render(<AlertsCard />);
    await fireEvent.press(screen.getByTestId("alerts-card-enable"));

    expect(mockLocationUnavailable).toHaveBeenCalledTimes(1);
  });

  // In this case only the missing location keeps the card up: touching
  // `is_enabled`, which is true anyway, would record an enable that never
  // happened.
  it("only stores the coordinates when alerts are already on", async () => {
    mockSettings = { is_enabled: true, location_lat: null };
    mockRequestLocation.mockResolvedValue({
      coords: [2.3488, 48.8534],
      accuracy: 10,
    });

    await render(<AlertsCard />);
    await fireEvent.press(screen.getByTestId("alerts-card-enable"));

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith({ lat: 48.85, lon: 2.35 }, true);
    expect(track).not.toHaveBeenCalled();
  });

  // A refused location must not cancel the enable: the settings may already have
  // a country from the profile, and the radius is something people also set by
  // hand.
  it("still turns alerts on when the location request came back empty", async () => {
    mockRequestLocation.mockResolvedValue(null);

    await render(<AlertsCard />);
    await fireEvent.press(screen.getByTestId("alerts-card-enable"));

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith({ is_enabled: true });
  });

  // A refused push permission likewise: the settings stay, and notifications will
  // flow as soon as the permission is granted in the system settings.
  it("still turns alerts on when push permission was refused", async () => {
    mockRequestPushPermission.mockResolvedValue(false);

    await render(<AlertsCard />);
    await fireEvent.press(screen.getByTestId("alerts-card-enable"));

    expect(mockSave).toHaveBeenCalledWith({ is_enabled: true });
  });
});

it("sends the second button to the alert settings screen", async () => {
  await render(<AlertsCard />);

  await fireEvent.press(screen.getByTestId("alerts-card-settings"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("AlertSettings");
});
