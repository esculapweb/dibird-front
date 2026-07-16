jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
// Layout only provides chrome — stub to a passthrough (children + bottom,
// this screen doesn't use `top`) so tests don't have to deal with
// react-native-svg (BackgroundScene2) or KeyboardAwareScrollView.
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
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(),
}));
jest.mock("../../util/auth", () => ({
  LoginWithGoogle: jest.fn(),
  LoginWithApple: jest.fn(),
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));

import { Platform } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { LoginWithGoogle, LoginWithApple } from "../../util/auth";
import { createNavigationMock } from "../test-utils";
import WelcomeScreen from "../WelcomeScreen";

const mockShowErrorToast = jest.fn();
const mockStackNav = createNavigationMock();
const mockNavigation = createNavigationMock({ getParent: jest.fn(() => mockStackNav) });

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
  (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);
});

afterEach(() => {
  Platform.OS = originalOS;
});

describe("Apple button visibility", () => {
  it("is hidden on Android — isAvailableAsync is never even checked", async () => {
    Platform.OS = "android";
    await render(<WelcomeScreen />);
    expect(AppleAuthentication.isAvailableAsync).not.toHaveBeenCalled();
    expect(screen.queryByText("continue_with_apple")).not.toBeOnTheScreen();
  });

  it("is hidden on iOS when isAvailableAsync resolves false", async () => {
    Platform.OS = "ios";
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    await render(<WelcomeScreen />);
    expect(screen.queryByText("continue_with_apple")).not.toBeOnTheScreen();
  });

  it("is shown on iOS when isAvailableAsync resolves true", async () => {
    Platform.OS = "ios";
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    await render(<WelcomeScreen />);
    expect(await screen.findByText("continue_with_apple")).toBeOnTheScreen();
  });
});

describe("Google sign-in", () => {
  it("taps call LoginWithGoogle", async () => {
    (LoginWithGoogle as jest.Mock).mockResolvedValue("access-token");
    await render(<WelcomeScreen />);

    await fireEvent.press(screen.getByText("continue_with_google"));

    expect(LoginWithGoogle).toHaveBeenCalledTimes(1);
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it("shows an error toast when LoginWithGoogle resolves null (Play Services unavailable)", async () => {
    (LoginWithGoogle as jest.Mock).mockResolvedValue(null);
    await render(<WelcomeScreen />);

    await fireEvent.press(screen.getByText("continue_with_google"));

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Google Play Services unavailable" }),
      "LoginWithGoogle",
    );
  });

  it("shows an error toast for a real failure, but stays silent on user cancellation", async () => {
    (LoginWithGoogle as jest.Mock).mockRejectedValueOnce({ code: "SIGN_IN_CANCELLED" });
    await render(<WelcomeScreen />);
    await fireEvent.press(screen.getByText("continue_with_google"));
    expect(mockShowErrorToast).not.toHaveBeenCalled();

    (LoginWithGoogle as jest.Mock).mockRejectedValueOnce({ code: "SOME_OTHER_ERROR" });
    await fireEvent.press(screen.getByText("continue_with_google"));
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SOME_OTHER_ERROR" }),
      "LoginWithGoogle",
    );
  });
});

describe("Apple sign-in", () => {
  beforeEach(() => {
    Platform.OS = "ios";
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  });

  it("tap calls LoginWithApple", async () => {
    (LoginWithApple as jest.Mock).mockResolvedValue("access-token");
    await render(<WelcomeScreen />);

    await fireEvent.press(await screen.findByText("continue_with_apple"));

    expect(LoginWithApple).toHaveBeenCalledTimes(1);
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it("shows an error toast for a real failure, but stays silent on user cancellation", async () => {
    (LoginWithApple as jest.Mock).mockRejectedValueOnce({ code: "ERR_REQUEST_CANCELED" });
    await render(<WelcomeScreen />);
    await fireEvent.press(await screen.findByText("continue_with_apple"));
    expect(mockShowErrorToast).not.toHaveBeenCalled();

    (LoginWithApple as jest.Mock).mockRejectedValueOnce({ code: "SOME_OTHER_ERROR" });
    await fireEvent.press(screen.getByText("continue_with_apple"));
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SOME_OTHER_ERROR" }),
      "LoginWithApple",
    );
  });
});

describe("navigation", () => {
  it("email button navigates to Login on the parent (auth) stack", async () => {
    await render(<WelcomeScreen />);
    await fireEvent.press(screen.getByText("continue_with_email"));
    expect(mockStackNav.navigate).toHaveBeenCalledWith("Login");
  });

  it("Terms/Privacy links navigate to the matching screens on the parent stack", async () => {
    await render(<WelcomeScreen />);
    await fireEvent.press(screen.getByText("terms_of_service_"));
    expect(mockStackNav.navigate).toHaveBeenCalledWith("Terms");

    await fireEvent.press(screen.getByText("privacy_policy_"));
    expect(mockStackNav.navigate).toHaveBeenCalledWith("Privacy");
  });
});
