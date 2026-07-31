jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(),
}));
jest.mock("../../../util/auth", () => ({
  LoginWithGoogle: jest.fn(),
  LoginWithApple: jest.fn(),
}));
jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("../../../services/analytics", () => ({ track: jest.fn() }));

import { Platform } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as AppleAuthentication from "expo-apple-authentication";

import { LoginWithGoogle, LoginWithApple } from "../../../util/auth";
import { track } from "../../../services/analytics";
import AuthOptions from "../AuthOptions";

const mockShowErrorToast = jest.fn();
const mockOnEmailPress = jest.fn();
const mockOnAuthenticated = jest.fn();

const originalOS = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = "ios";
  (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
});

afterEach(() => {
  Platform.OS = originalOS;
});

const renderOptions = () =>
  render(
    <AuthOptions
      onEmailPress={mockOnEmailPress}
      onAuthenticated={mockOnAuthenticated}
    />,
  );

// The "account required" sheet hangs in a portal outside the navigator: after a
// sign-in it would stay on top of an already logged-in app, so success has to
// reach the caller. Welcome does not pass the same callback — it has nothing to
// close.
describe("onAuthenticated", () => {
  it("fires after a successful Google sign-in", async () => {
    (LoginWithGoogle as jest.Mock).mockResolvedValue("access-token");
    await renderOptions();

    await fireEvent.press(screen.getByTestId("auth-option-google"));

    expect(mockOnAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("fires after a successful Apple sign-in", async () => {
    (LoginWithApple as jest.Mock).mockResolvedValue("access-token");
    await renderOptions();

    await fireEvent.press(await screen.findByTestId("auth-option-apple"));

    expect(mockOnAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("stays silent when the user cancels", async () => {
    (LoginWithGoogle as jest.Mock).mockRejectedValueOnce({
      code: "SIGN_IN_CANCELLED",
    });
    await renderOptions();

    await fireEvent.press(screen.getByTestId("auth-option-google"));

    expect(mockOnAuthenticated).not.toHaveBeenCalled();
    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  // null means "Play Services unavailable" and the toast is already shown:
  // closing the sheet here would hide the only remaining way to sign in.
  it("stays silent when Google resolves null", async () => {
    (LoginWithGoogle as jest.Mock).mockResolvedValue(null);
    await renderOptions();

    await fireEvent.press(screen.getByTestId("auth-option-google"));

    expect(mockOnAuthenticated).not.toHaveBeenCalled();
    expect(mockShowErrorToast).toHaveBeenCalled();
  });
});

describe("email option", () => {
  it("hands the navigation to the caller instead of doing it itself", async () => {
    await renderOptions();

    await fireEvent.press(screen.getByTestId("auth-option-email"));

    expect(mockOnEmailPress).toHaveBeenCalledTimes(1);
  });
});

describe("Apple button visibility", () => {
  it("is hidden on Android — isAvailableAsync is never even checked", async () => {
    Platform.OS = "android";
    await renderOptions();

    expect(AppleAuthentication.isAvailableAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId("auth-option-apple")).not.toBeOnTheScreen();
  });

  it("is hidden on iOS when isAvailableAsync resolves false", async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(
      false,
    );
    await renderOptions();

    expect(screen.queryByTestId("auth-option-apple")).not.toBeOnTheScreen();
  });
});

// `auth_started` answers the question "how many people tapped the button but
// never got an account": without it a drop-off inside the provider (a cancelled
// system dialog, unavailable Play Services) is indistinguishable from "never
// tapped".
describe("auth_started", () => {
  it("fires on the Google tap", async () => {
    (LoginWithGoogle as jest.Mock).mockResolvedValue("access-token");
    await renderOptions();

    await fireEvent.press(screen.getByTestId("auth-option-google"));

    expect(track).toHaveBeenCalledWith("auth_started", { method: "google" });
  });

  it("fires on the Apple tap", async () => {
    (LoginWithApple as jest.Mock).mockResolvedValue("access-token");
    await renderOptions();

    await fireEvent.press(await screen.findByTestId("auth-option-apple"));

    expect(track).toHaveBeenCalledWith("auth_started", { method: "apple" });
  });

  it("still fires when the provider then fails", async () => {
    (LoginWithGoogle as jest.Mock).mockRejectedValueOnce({ code: "BOOM" });
    await renderOptions();

    await fireEvent.press(screen.getByTestId("auth-option-google"));

    expect(track).toHaveBeenCalledWith("auth_started", { method: "google" });
  });

  // The "with email" button only opens the form — the sign-in attempt itself
  // happens on the Login screen, and the event is sent from there (AuthContent),
  // after validation.
  it("does not fire on the email button, which only opens the form", async () => {
    await renderOptions();

    await fireEvent.press(screen.getByTestId("auth-option-email"));

    expect(mockOnEmailPress).toHaveBeenCalledTimes(1);
    expect(track).not.toHaveBeenCalled();
  });
});
