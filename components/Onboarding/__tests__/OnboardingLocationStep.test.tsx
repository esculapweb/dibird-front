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
jest.mock("../../../store/location-context", () => ({
  useLocation: () => ({
    requestLocation: mockRequestLocation,
    getPermissionStatus: mockGetPermissionStatus,
  }),
}));
jest.mock("../../../store/alert-settings-context", () => ({
  useAlertSettings: () => ({ save: mockSave }),
}));
jest.mock("../../../hooks/useLocationUnavailable", () => ({
  useLocationUnavailable: () => mockLocationUnavailable,
}));
jest.mock("../../../hooks/usePushNotifications", () => ({
  requestPushPermission: jest.fn(),
}));
jest.mock("../../../services/analytics", () => ({ track: jest.fn() }));

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { requestPushPermission } from "../../../hooks/usePushNotifications";
import { track } from "../../../services/analytics";
import OnboardingLocationStep from "../OnboardingLocationStep";

const mockRequestLocation = jest.fn();
const mockGetPermissionStatus = jest.fn();
const mockSave = jest.fn();
const mockLocationUnavailable = jest.fn();
const mockRequestPushPermission = requestPushPermission as jest.Mock;

const allow = async () =>
  fireEvent.press(screen.getByTestId("onboarding-location-allow"));

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestLocation.mockResolvedValue({ coords: [2.3488, 48.8534], accuracy: 10 });
  mockGetPermissionStatus.mockReturnValue("granted");
  mockSave.mockResolvedValue(true);
  mockRequestPushPermission.mockResolvedValue(true);
});

// Шаг именно про оповещения о редкостях рядом: без пушей они не доедут, без
// координат — не про «рядом». Порядок как в AlertsCard: сначала пуши.
it("asks for both permissions and stores the coordinates", async () => {
  await render(<OnboardingLocationStep />);
  await allow();

  expect(mockRequestPushPermission).toHaveBeenCalledTimes(1);
  expect(mockRequestLocation).toHaveBeenCalledTimes(1);
  // sync: без него страну по координатам резолвит отложенная задача, и первый
  // же экран после онбординга показал бы «поблизости» без страны.
  expect(mockSave).toHaveBeenCalledWith({ lat: 48.85, lon: 2.35 }, true);
  expect(track).toHaveBeenCalledWith("onboarding_location_set");
});

it("switches to the confirmation once the fix arrived", async () => {
  await render(<OnboardingLocationStep />);
  await allow();

  expect(screen.getByText("onboarding_location_done_title")).toBeOnTheScreen();
  expect(
    screen.queryByTestId("onboarding-location-allow"),
  ).not.toBeOnTheScreen();
});

it("points at the OS settings when the permission was refused", async () => {
  mockRequestLocation.mockResolvedValue(null);
  mockGetPermissionStatus.mockReturnValue("denied");

  await render(<OnboardingLocationStep />);
  await allow();

  expect(mockLocationUnavailable).toHaveBeenCalledTimes(1);
  expect(mockSave).not.toHaveBeenCalled();
  expect(screen.getByTestId("onboarding-location-allow")).toBeOnTheScreen();
});

// Фикс может не приехать и без отказа — GPS в помещении, таймаут. Гнать
// человека в системные настройки в этом случае не за чем: кнопка остаётся,
// и её можно нажать ещё раз.
it("keeps the button and stays quiet when the fix simply did not arrive", async () => {
  mockRequestLocation.mockResolvedValue(null);
  mockGetPermissionStatus.mockReturnValue("granted");

  await render(<OnboardingLocationStep />);
  await allow();

  expect(mockLocationUnavailable).not.toHaveBeenCalled();
  expect(screen.getByTestId("onboarding-location-allow")).toBeOnTheScreen();
});

// Кнопка гасится по-настоящему, а не только визуально: системный диалог
// поверх второго запроса — это два подряд, и второй ОС уже не покажет.
it("locks the button while the request is in flight", async () => {
  let resolveLocation: (v: unknown) => void = () => {};
  mockRequestLocation.mockReturnValue(
    new Promise((resolve) => {
      resolveLocation = resolve;
    }),
  );

  await render(<OnboardingLocationStep />);
  const button = screen.getByTestId("onboarding-location-allow");
  fireEvent.press(button);

  await waitFor(() => expect(button).toBeDisabled());

  resolveLocation(null);
  await waitFor(() => expect(button).not.toBeDisabled());
});
