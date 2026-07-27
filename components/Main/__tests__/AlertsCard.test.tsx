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
  useLocation: () => ({ requestLocation: mockRequestLocation }),
}));
jest.mock("../../../hooks/usePushNotifications", () => ({
  requestPushPermission: jest.fn(),
}));
jest.mock("../../../services/analytics", () => ({ track: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";

import { createNavigationMock } from "../../../screens/test-utils";
import { requestPushPermission } from "../../../hooks/usePushNotifications";
import { track } from "../../../services/analytics";
import AlertsCard from "../AlertsCard";

const mockNavigation = createNavigationMock();
const mockSave = jest.fn();
const mockRequestLocation = jest.fn();
const mockRequestPushPermission = requestPushPermission as jest.Mock;

let mockSettings: { is_enabled: boolean } | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = { is_enabled: false };
  mockSave.mockResolvedValue(true);
  mockRequestLocation.mockResolvedValue(null);
  mockRequestPushPermission.mockResolvedValue(true);
});

describe("visibility", () => {
  it("shows up while alerts are off", async () => {
    await render(<AlertsCard />);

    expect(screen.getByTestId("alerts-card")).toBeOnTheScreen();
  });

  it("disappears once alerts are on", async () => {
    mockSettings = { is_enabled: true };
    await render(<AlertsCard />);

    expect(screen.queryByTestId("alerts-card")).not.toBeOnTheScreen();
  });

  // Пока настройки не приехали (или пользователь не залогинен), состояние
  // неизвестно — мигать карточкой в это время нельзя.
  it("stays away while the settings are unknown", async () => {
    mockSettings = null;
    await render(<AlertsCard />);

    expect(screen.queryByTestId("alerts-card")).not.toBeOnTheScreen();
  });
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

    expect(mockSave).toHaveBeenCalledWith({ lat: 48.85, lon: 2.35 });
    expect(mockSave).toHaveBeenCalledWith({ is_enabled: true });
  });

  // Отказ в геопозиции не должен отменять включение: у настроек уже может быть
  // страна из профиля, а радиус — величина, которую задают и вручную.
  it("still turns alerts on when the location request came back empty", async () => {
    mockRequestLocation.mockResolvedValue(null);

    await render(<AlertsCard />);
    await fireEvent.press(screen.getByTestId("alerts-card-enable"));

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith({ is_enabled: true });
  });

  // Отказ в пушах тоже: настройки останутся, и уведомления поедут, как только
  // разрешение выдадут в системных настройках.
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
