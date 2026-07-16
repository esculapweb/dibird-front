jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn(), hide: jest.fn() }));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));

const mockAuthFormCapture = jest.fn();
jest.mock("../AuthForm", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockAuthFormCapture(props);
    return null;
  },
}));

jest.mock("../../ui/Logo", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="logo" /> };
});

jest.mock("../../ui/FormWrapper", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  return {
    __esModule: true,
    default: ({
      header,
      bottomButtonLabel,
      bottomButtonHandler,
      children,
    }: {
      header?: import("react").ReactNode;
      bottomButtonLabel?: string;
      bottomButtonHandler?: () => void;
      children: import("react").ReactNode;
    }) => (
      <View>
        {header}
        {children}
        {bottomButtonLabel && (
          <TouchableOpacity testID="switch-auth-mode" onPress={bottomButtonHandler}>
            <Text>{bottomButtonLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
  };
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { createNavigationMock } from "../../../screens/test-utils";
import AuthContent from "../AuthContent";
import { Credentials } from "../../../types";

const mockShowErrorToast = jest.fn();
const mockNavigation = createNavigationMock();

const authFormProps = () => mockAuthFormCapture.mock.calls.at(-1)![0] as {
  onSubmit: (credentials: Credentials) => Promise<void>;
  credentialsInvalid: Record<string, boolean>;
  loading: boolean;
  isLogin?: boolean;
  prefillEmail?: string;
};

const submit = async (credentials: Credentials) => {
  await act(async () => {
    await authFormProps().onSubmit(credentials);
  });
};

const mockOnAuthenticate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockOnAuthenticate.mockResolvedValue(undefined);
});

describe("header content", () => {
  it("shows the confirmation header when logging in right after confirming an email", async () => {
    await render(
      <AuthContent isLogin onAuthenticate={mockOnAuthenticate} loading={false} emailConfirmed />,
    );
    expect(screen.getByText("email_confirmed")).toBeOnTheScreen();
    expect(screen.getByText("can_login_now")).toBeOnTheScreen();
  });

  it("shows the welcome-back header for a plain login", async () => {
    await render(<AuthContent isLogin onAuthenticate={mockOnAuthenticate} loading={false} />);
    expect(screen.getByText("welcome_back")).toBeOnTheScreen();
    expect(screen.getByText("login_to_continue")).toBeOnTheScreen();
  });

  it("shows the signup header, ignoring emailConfirmed", async () => {
    await render(
      <AuthContent
        isLogin={false}
        onAuthenticate={mockOnAuthenticate}
        loading={false}
        emailConfirmed
      />,
    );
    expect(screen.getByText("welcome")).toBeOnTheScreen();
    expect(screen.getByText("create_account")).toBeOnTheScreen();
  });
});

describe("mode switch", () => {
  it("replaces to Signup when switching away from login", async () => {
    await render(<AuthContent isLogin onAuthenticate={mockOnAuthenticate} loading={false} />);
    expect(screen.getByText("create_new_user")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("switch-auth-mode"));
    expect(mockNavigation.replace).toHaveBeenCalledWith("Signup");
  });

  it("replaces to Login with emailConfirmed/prefillEmail when switching away from signup", async () => {
    await render(
      <AuthContent
        isLogin={false}
        onAuthenticate={mockOnAuthenticate}
        loading={false}
        emailConfirmed
        prefillEmail="jane@example.com"
      />,
    );
    expect(screen.getByText("login_instead")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("switch-auth-mode"));
    expect(mockNavigation.replace).toHaveBeenCalledWith("Login", {
      emailConfirmed: true,
      prefillEmail: "jane@example.com",
    });
  });
});

describe("submit validation — login", () => {
  const credentials = (overrides: Partial<Credentials> = {}): Credentials => ({
    email: "jane@example.com",
    userName: "",
    password: "hunter22",
    confirmPassword: "",
    ...overrides,
  });

  it("authenticates with trimmed email/password when valid", async () => {
    await render(<AuthContent isLogin onAuthenticate={mockOnAuthenticate} loading={false} />);
    await submit(credentials({ email: " jane@example.com ", password: " hunter22 " }));

    expect(mockOnAuthenticate).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "hunter22",
    });
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("rejects an email without '@' and flags it, without authenticating", async () => {
    await render(<AuthContent isLogin onAuthenticate={mockOnAuthenticate} loading={false} />);
    await submit(credentials({ email: "not-an-email" }));

    expect(mockOnAuthenticate).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", text1: "invalid_input" }),
    );
    expect(authFormProps().credentialsInvalid).toEqual({
      email: true,
      userName: false,
      password: false,
      confirmPassword: false,
    });
  });

  it("rejects a password of 6 characters or fewer", async () => {
    await render(<AuthContent isLogin onAuthenticate={mockOnAuthenticate} loading={false} />);
    await submit(credentials({ password: "short1" }));

    expect(mockOnAuthenticate).not.toHaveBeenCalled();
    expect(authFormProps().credentialsInvalid.password).toBe(true);
  });

  it("does not require username/confirmPassword to match while logging in", async () => {
    await render(<AuthContent isLogin onAuthenticate={mockOnAuthenticate} loading={false} />);
    await submit(credentials({ userName: "", confirmPassword: "totally-different" }));

    expect(mockOnAuthenticate).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "hunter22",
    });
  });
});

describe("submit validation — signup", () => {
  const credentials = (overrides: Partial<Credentials> = {}): Credentials => ({
    email: "jane@example.com",
    userName: "jane",
    password: "hunter22",
    confirmPassword: "hunter22",
    ...overrides,
  });

  it("authenticates with email/password/userName when everything is valid", async () => {
    await render(<AuthContent isLogin={false} onAuthenticate={mockOnAuthenticate} loading={false} />);
    await submit(credentials());

    expect(mockOnAuthenticate).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "hunter22",
      userName: "jane",
    });
  });

  it("rejects an empty username", async () => {
    await render(<AuthContent isLogin={false} onAuthenticate={mockOnAuthenticate} loading={false} />);
    await submit(credentials({ userName: "" }));

    expect(mockOnAuthenticate).not.toHaveBeenCalled();
    expect(authFormProps().credentialsInvalid.userName).toBe(true);
  });

  it("rejects a username equal to the email", async () => {
    await render(<AuthContent isLogin={false} onAuthenticate={mockOnAuthenticate} loading={false} />);
    await submit(credentials({ userName: "jane@example.com" }));

    expect(mockOnAuthenticate).not.toHaveBeenCalled();
    expect(authFormProps().credentialsInvalid.userName).toBe(true);
  });

  it("rejects mismatched passwords", async () => {
    await render(<AuthContent isLogin={false} onAuthenticate={mockOnAuthenticate} loading={false} />);
    await submit(credentials({ confirmPassword: "something-else" }));

    expect(mockOnAuthenticate).not.toHaveBeenCalled();
    expect(authFormProps().credentialsInvalid.confirmPassword).toBe(true);
  });
});

describe("onAuthenticate failure", () => {
  it("shows an error toast with a field-mapping extractor for a non-connectivity error", async () => {
    mockOnAuthenticate.mockRejectedValue(new Error("boom"));
    await render(<AuthContent isLogin onAuthenticate={mockOnAuthenticate} loading={false} />);

    await submit({ email: "jane@example.com", userName: "", password: "hunter22", confirmPassword: "" });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.any(Error),
      "AuthContentSubmit",
      expect.any(Function),
    );
  });

  it("omits the extractor (falls back to a generic connectivity toast) on a network error", async () => {
    mockOnAuthenticate.mockRejectedValue({ isNetworkError: true });
    await render(<AuthContent isLogin onAuthenticate={mockOnAuthenticate} loading={false} />);

    await submit({ email: "jane@example.com", userName: "", password: "hunter22", confirmPassword: "" });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({ isNetworkError: true }),
      "AuthContentSubmit",
      undefined,
    );
  });

  it("omits the extractor on a timeout error", async () => {
    mockOnAuthenticate.mockRejectedValue({ isTimeout: true });
    await render(<AuthContent isLogin onAuthenticate={mockOnAuthenticate} loading={false} />);

    await submit({ email: "jane@example.com", userName: "", password: "hunter22", confirmPassword: "" });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.objectContaining({ isTimeout: true }),
      "AuthContentSubmit",
      undefined,
    );
  });
});

describe("extractApiError (captured from a failed submit)", () => {
  const extractorAfter = async (isLogin: boolean) => {
    mockOnAuthenticate.mockRejectedValue(new Error("boom"));
    await render(<AuthContent isLogin={isLogin} onAuthenticate={mockOnAuthenticate} loading={false} />);
    await submit({
      email: "jane@example.com",
      userName: isLogin ? "" : "jane",
      password: "hunter22",
      confirmPassword: isLogin ? "" : "hunter22",
    });
    return mockShowErrorToast.mock.calls.at(-1)![2] as (err: unknown) => { title: string; message: string };
  };

  it("falls back to a generic login-failed message when the API gives no response data", async () => {
    const extract = await extractorAfter(true);
    expect(extract({})).toEqual({ title: "login_failed", message: "could_not_login" });
  });

  it("uses non_field_errors first when present", async () => {
    const extract = await extractorAfter(true);
    expect(
      extract({ response: { data: { non_field_errors: ["Invalid credentials"], email: ["ignored"] } } }),
    ).toEqual({ title: "login_failed", message: "Invalid credentials" });
  });

  it("falls back through email/username/password before joining all field errors", async () => {
    const extract = await extractorAfter(false);
    expect(extract({ response: { data: { email: ["Email taken"] } } })).toEqual({
      title: "registration_failed",
      message: "Email taken",
    });
    expect(extract({ response: { data: { username: ["Username taken"] } } })).toEqual({
      title: "registration_failed",
      message: "Username taken",
    });
    expect(extract({ response: { data: { password: ["Too weak"] } } })).toEqual({
      title: "registration_failed",
      message: "Too weak",
    });
  });

  it("joins arbitrary field errors when none of the known keys match", async () => {
    const extract = await extractorAfter(false);
    expect(
      extract({ response: { data: { some_field: ["Bad value"], other_field: ["Also bad"] } } }),
    ).toEqual({
      title: "registration_failed",
      message: "Bad value\nAlso bad",
    });
  });
});
