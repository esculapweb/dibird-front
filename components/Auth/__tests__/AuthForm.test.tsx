jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});

const mockInputCapture = jest.fn();
jest.mock("../../ui/Input", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockInputCapture(props);
    return null;
  },
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import AuthForm from "../AuthForm";
import { CredentialsValidation } from "../../../types";

const NOT_INVALID: CredentialsValidation = {
  email: false,
  userName: false,
  password: false,
  confirmPassword: false,
};

interface CapturedInputProps {
  label: string;
  value: string;
  isInvalid?: boolean;
  onUpdateValue: (value: string) => void;
}

const inputsByTestId = () => {
  const byLabel: Record<string, CapturedInputProps> = {};
  for (const call of mockInputCapture.mock.calls) {
    const props = call[0] as CapturedInputProps;
    byLabel[props.label] = props;
  }
  return byLabel;
};

const baseProps = () => ({
  onSubmit: mockOnSubmit,
  credentialsInvalid: NOT_INVALID,
  loading: false,
});

const mockOnSubmit = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("field visibility", () => {
  it("shows only email + password fields in login mode", async () => {
    await render(<AuthForm {...baseProps()} isLogin />);

    const labels = Object.keys(inputsByTestId());
    expect(labels).toEqual(["email_address", "password"]);
    expect(screen.getByTestId("login-submit-button")).toBeOnTheScreen();
  });

  it("shows username, email, password, confirm-password fields in signup mode", async () => {
    await render(<AuthForm {...baseProps()} isLogin={false} />);

    const labels = Object.keys(inputsByTestId());
    expect(labels).toEqual(["username", "email_address", "password", "confirm_password"]);
    expect(screen.getByTestId("signup-submit-button")).toBeOnTheScreen();
  });
});

describe("prefillEmail", () => {
  it("seeds the email field's initial value", async () => {
    await render(<AuthForm {...baseProps()} isLogin prefillEmail="jane@example.com" />);
    expect(inputsByTestId().email_address.value).toBe("jane@example.com");
  });
});

describe("credentialsInvalid", () => {
  it("forwards isInvalid flags to the matching fields", async () => {
    await render(
      <AuthForm
        {...baseProps()}
        isLogin={false}
        credentialsInvalid={{
          email: true,
          userName: true,
          password: true,
          confirmPassword: true,
        }}
      />,
    );

    const fields = inputsByTestId();
    expect(fields.username.isInvalid).toBe(true);
    expect(fields.email_address.isInvalid).toBe(true);
    expect(fields.password.isInvalid).toBe(true);
    expect(fields.confirm_password.isInvalid).toBe(true);
  });
});

describe("submit", () => {
  it("submits entered login credentials", async () => {
    await render(<AuthForm {...baseProps()} isLogin />);

    await act(async () => inputsByTestId().email_address.onUpdateValue("jane@example.com"));
    await act(async () => inputsByTestId().password.onUpdateValue("hunter2"));

    await fireEvent.press(screen.getByTestId("login-submit-button"));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      email: "jane@example.com",
      userName: "",
      password: "hunter2",
      confirmPassword: "",
    });
  });

  it("submits entered signup credentials, including username and confirm-password", async () => {
    await render(<AuthForm {...baseProps()} isLogin={false} />);

    await act(async () => inputsByTestId().username.onUpdateValue("jane"));
    await act(async () => inputsByTestId().email_address.onUpdateValue("jane@example.com"));
    await act(async () => inputsByTestId().password.onUpdateValue("hunter2"));
    await act(async () => inputsByTestId().confirm_password.onUpdateValue("hunter2"));

    await fireEvent.press(screen.getByTestId("signup-submit-button"));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      email: "jane@example.com",
      userName: "jane",
      password: "hunter2",
      confirmPassword: "hunter2",
    });
  });
});

describe("loading", () => {
  it("disables the submit button while loading", async () => {
    await render(<AuthForm {...baseProps()} isLogin loading />);
    await fireEvent.press(screen.getByTestId("login-submit-button"));
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
