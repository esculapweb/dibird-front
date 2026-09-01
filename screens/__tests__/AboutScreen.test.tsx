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
jest.mock("../../util/openSupportEmail", () => ({ openSupportEmail: jest.fn() }));
jest.mock("../../util/openDonatePage", () => ({ openDonatePage: jest.fn() }));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));
jest.mock("../../util/helpers", () => ({
  ...jest.requireActual("../../util/helpers"),
  getFullVersion: () => "1.0.0 (42)",
}));

import { Share, Platform } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { openSupportEmail } from "../../util/openSupportEmail";
import { openDonatePage } from "../../util/openDonatePage";
import { track } from "../../services/analytics";
import { createNavigationMock } from "../test-utils";
import AboutScreen from "../AboutScreen";

const mockNavigation = createNavigationMock();
const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("renders every row and the app version", async () => {
  await render(<AboutScreen />);
  expect(screen.getByText("settings_tell_a_friend")).toBeOnTheScreen();
  expect(screen.getByText("settings_send_feedback")).toBeOnTheScreen();
  expect(screen.getByText("settings_support_project")).toBeOnTheScreen();
  expect(screen.getByText("privacy_policy")).toBeOnTheScreen();
  expect(screen.getByText("terms_of_service")).toBeOnTheScreen();
  expect(screen.getByText('app_version:{"version":"1.0.0 (42)"}')).toBeOnTheScreen();
});

it("tells a friend with a platform-appropriate share payload", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
  Platform.OS = "ios";
  await render(<AboutScreen />);
  await fireEvent.press(screen.getByText("settings_tell_a_friend"));
  expect(track).toHaveBeenCalledWith("share_tapped", { type: "app" });
  expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining("http") }));

  shareSpy.mockClear();
  Platform.OS = "android";
  await render(<AboutScreen />);
  await fireEvent.press(screen.getByText("settings_tell_a_friend"));
  expect(shareSpy).toHaveBeenCalledWith({ message: "tell_a_friend_message" });
});

it("send feedback opens the support email composer", async () => {
  await render(<AboutScreen />);
  await fireEvent.press(screen.getByText("settings_send_feedback"));
  expect(openSupportEmail).toHaveBeenCalledTimes(1);
});

// The source is what the donation page reports back — it stays "settings" even
// though the row now lives one screen deeper, so the existing analytics keep
// comparing with themselves.
it("support the project opens the donation page with the settings source", async () => {
  await render(<AboutScreen />);
  await fireEvent.press(screen.getByText("settings_support_project"));
  expect(openDonatePage).toHaveBeenCalledWith("settings");
});

it("navigates to Privacy and Terms", async () => {
  await render(<AboutScreen />);
  await fireEvent.press(screen.getByText("privacy_policy"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("Privacy");
  await fireEvent.press(screen.getByText("terms_of_service"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("Terms");
});
