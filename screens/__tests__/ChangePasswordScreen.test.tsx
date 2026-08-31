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
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => (
      <View>{children}</View>
    ),
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => mockQuery,
}));
jest.mock("../../util/auth", () => ({
  changePassword: jest.fn(),
}));
jest.mock("../../util/fetches", () => ({
  fetchMyProfile: jest.fn(),
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { changePassword } from "../../util/auth";
import { createNavigationMock } from "../test-utils";
import ChangePasswordScreen from "../ChangePasswordScreen";

const mockNavigation = createNavigationMock();
const mockShowErrorToast = jest.fn();
let mockQuery: Record<string, unknown>;

const profileQuery = (hasUsablePassword: boolean) => ({
  data: { has_usable_password: hasUsablePassword },
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
});

const typePasswords = async (value: string, confirm = value) => {
  await fireEvent.changeText(screen.getByTestId("new-password-input"), value);
  await fireEvent.changeText(
    screen.getByTestId("new-password-confirm-input"),
    confirm,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  (changePassword as jest.Mock).mockResolvedValue(undefined);
  mockQuery = profileQuery(true);
});

describe("for an account that already has a password", () => {
  it("asks for the current one and sends it", async () => {
    await render(<ChangePasswordScreen />);

    await fireEvent.changeText(
      screen.getByTestId("current-password-input"),
      "old-one",
    );
    await typePasswords("hunter22");
    await fireEvent.press(screen.getByTestId("change-password-submit-button"));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        oldPassword: "old-one",
        password: "hunter22",
      }),
    );
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it("refuses to submit without the current password", async () => {
    await render(<ChangePasswordScreen />);

    await typePasswords("hunter22");
    await fireEvent.press(screen.getByTestId("change-password-submit-button"));

    expect(changePassword).not.toHaveBeenCalled();
  });
});

describe("for an account signed in only with Google or Apple", () => {
  beforeEach(() => {
    mockQuery = profileQuery(false);
  });

  // Asking such a person for a current password would lock them out of ever
  // having one: check_password() is false for any input on an unusable
  // password, so every attempt would be refused.
  it("does not ask for a current password", async () => {
    await render(<ChangePasswordScreen />);

    expect(screen.queryByTestId("current-password-input")).not.toBeOnTheScreen();
  });

  it("sends the new password with no old_password at all", async () => {
    await render(<ChangePasswordScreen />);

    await typePasswords("hunter22");
    await fireEvent.press(screen.getByTestId("change-password-submit-button"));

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        oldPassword: undefined,
        password: "hunter22",
      }),
    );
  });

  it("says the password was set, not changed", async () => {
    await render(<ChangePasswordScreen />);

    await typePasswords("hunter22");
    await fireEvent.press(screen.getByTestId("change-password-submit-button"));

    await waitFor(() =>
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ text1: "password_set" }),
      ),
    );
  });
});

describe("validation", () => {
  it("refuses a password shorter than the minimum", async () => {
    await render(<ChangePasswordScreen />);

    await fireEvent.changeText(
      screen.getByTestId("current-password-input"),
      "old-one",
    );
    await typePasswords("short");
    await fireEvent.press(screen.getByTestId("change-password-submit-button"));

    expect(changePassword).not.toHaveBeenCalled();
  });

  it("refuses a confirmation that does not match", async () => {
    await render(<ChangePasswordScreen />);

    await fireEvent.changeText(
      screen.getByTestId("current-password-input"),
      "old-one",
    );
    await typePasswords("hunter22", "hunter23");
    await fireEvent.press(screen.getByTestId("change-password-submit-button"));

    expect(changePassword).not.toHaveBeenCalled();
  });

  it("reports a rejected change instead of leaving the screen", async () => {
    (changePassword as jest.Mock).mockRejectedValue({
      response: { data: { old_password: ["wrong"] } },
    });
    await render(<ChangePasswordScreen />);

    await fireEvent.changeText(
      screen.getByTestId("current-password-input"),
      "not-the-one",
    );
    await typePasswords("hunter22");
    await fireEvent.press(screen.getByTestId("change-password-submit-button"));

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });
});
