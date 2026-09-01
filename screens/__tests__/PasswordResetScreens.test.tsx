jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../components/ui/FormWrapper", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({
      children,
      header,
    }: {
      children: import("react").ReactNode;
      header?: import("react").ReactNode;
    }) => (
      <View>
        {header}
        {children}
      </View>
    ),
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../util/auth", () => ({
  requestPasswordReset: jest.fn(),
  confirmPasswordReset: jest.fn(),
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { confirmPasswordReset, requestPasswordReset } from "../../util/auth";
import { createNavigationMock, createRouteMock } from "../test-utils";
import ForgotPasswordScreen from "../ForgotPasswordScreen";
import ResetPasswordScreen from "../ResetPasswordScreen";

const mockNavigation = createNavigationMock();
const mockShowErrorToast = jest.fn();
let mockRoute: ReturnType<typeof createRouteMock>;

beforeEach(() => {
  jest.clearAllMocks();
  (requestPasswordReset as jest.Mock).mockResolvedValue(undefined);
  (confirmPasswordReset as jest.Mock).mockResolvedValue(undefined);
});

describe("asking for a reset letter", () => {
  beforeEach(() => {
    mockRoute = createRouteMock("ForgotPassword", undefined);
  });

  it("sends the address and moves on to the 'check your inbox' screen", async () => {
    await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(
      screen.getByTestId("forgot-password-email-input"),
      "  jane@example.com  ",
    );
    await fireEvent.press(screen.getByTestId("forgot-password-submit-button"));

    await waitFor(() =>
      expect(requestPasswordReset).toHaveBeenCalledWith("jane@example.com"),
    );
    // `reset` mode, so "send it again" asks for another reset link rather than
    // resending a signup confirmation.
    expect(mockNavigation.replace).toHaveBeenCalledWith("CheckEmail", {
      email: "jane@example.com",
      mode: "reset",
    });
  });

  it("does not call the server for something that is not an address", async () => {
    await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(
      screen.getByTestId("forgot-password-email-input"),
      "nope",
    );
    await fireEvent.press(screen.getByTestId("forgot-password-submit-button"));

    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it("prefills the address it was given", async () => {
    mockRoute = createRouteMock("ForgotPassword", {
      prefillEmail: "jane@example.com",
    });
    await render(<ForgotPasswordScreen />);

    expect(screen.getByTestId("forgot-password-email-input").props.value).toBe(
      "jane@example.com",
    );
  });

  it("stays put and reports when the request fails", async () => {
    (requestPasswordReset as jest.Mock).mockRejectedValue({
      response: { data: { email: ["nope"] } },
    });
    await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(
      screen.getByTestId("forgot-password-email-input"),
      "jane@example.com",
    );
    await fireEvent.press(screen.getByTestId("forgot-password-submit-button"));

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });
});

describe("setting the new password from the link", () => {
  beforeEach(() => {
    mockRoute = createRouteMock("ResetPassword", {
      uid: "687",
      token: "de75v1-de5817b3",
    });
  });

  const typePasswords = async (value: string, confirm = value) => {
    await fireEvent.changeText(
      screen.getByTestId("reset-password-input"),
      value,
    );
    await fireEvent.changeText(
      screen.getByTestId("reset-password-confirm-input"),
      confirm,
    );
  };

  it("sends the pair from the URL along with the new password", async () => {
    await render(<ResetPasswordScreen />);

    await typePasswords("hunter22");
    await fireEvent.press(screen.getByTestId("reset-password-submit-button"));

    await waitFor(() =>
      expect(confirmPasswordReset).toHaveBeenCalledWith({
        uid: "687",
        token: "de75v1-de5817b3",
        password: "hunter22",
      }),
    );
  });

  // The confirm call returns no session, so the way on is the login screen —
  // with the password the person has just chosen.
  it("sends the person to Login afterwards", async () => {
    await render(<ResetPasswordScreen />);

    await typePasswords("hunter22");
    await fireEvent.press(screen.getByTestId("reset-password-submit-button"));

    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith("Login", undefined),
    );
  });

  it("refuses a password shorter than the minimum", async () => {
    await render(<ResetPasswordScreen />);

    await typePasswords("short");
    await fireEvent.press(screen.getByTestId("reset-password-submit-button"));

    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("refuses a confirmation that does not match", async () => {
    await render(<ResetPasswordScreen />);

    await typePasswords("hunter22", "hunter23");
    await fireEvent.press(screen.getByTestId("reset-password-submit-button"));

    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  // A spent key and a rejected password are different problems: one is fixed
  // by asking for a new letter, the other by typing a better password.
  it("names a dead link rather than blaming the password", async () => {
    (confirmPasswordReset as jest.Mock).mockRejectedValue({
      response: { data: { token: ["Invalid value"] } },
    });
    await render(<ResetPasswordScreen />);

    await typePasswords("hunter22");
    await fireEvent.press(screen.getByTestId("reset-password-submit-button"));

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
    const extractor = mockShowErrorToast.mock.calls.at(-1)![2];
    expect(
      extractor({ response: { data: { token: ["Invalid value"] } } }).message,
    ).toBe("reset_link_expired");
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it("passes a password complaint through instead", async () => {
    await render(<ResetPasswordScreen />);
    (confirmPasswordReset as jest.Mock).mockRejectedValue({
      response: { data: { new_password2: ["This password is too common."] } },
    });

    await typePasswords("hunter22");
    await fireEvent.press(screen.getByTestId("reset-password-submit-button"));

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
    const extractor = mockShowErrorToast.mock.calls.at(-1)![2];
    expect(
      extractor({
        response: { data: { new_password2: ["This password is too common."] } },
      }).message,
    ).toBe("This password is too common.");
  });
});
