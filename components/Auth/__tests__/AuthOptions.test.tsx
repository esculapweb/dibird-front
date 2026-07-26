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

import { Platform } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as AppleAuthentication from "expo-apple-authentication";

import { LoginWithGoogle, LoginWithApple } from "../../../util/auth";
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

// Шторка «нужен аккаунт» висит в портале вне навигатора: после входа она бы
// осталась поверх уже залогиненного приложения, поэтому успех обязан дойти
// до вызывающего. Welcome тот же колбэк не передаёт — ему закрывать нечего.
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

  // null — это «Play Services недоступны», тост уже показан: закрывать
  // шторку тут значило бы спрятать единственный оставшийся способ войти.
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
