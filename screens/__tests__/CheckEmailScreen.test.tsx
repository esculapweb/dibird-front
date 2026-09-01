jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
  };
});
jest.mock("@react-navigation/native", () => ({
  useRoute: () => mockRoute,
}));
jest.mock("../../util/openSupportEmail", () => ({
  openSupportEmail: jest.fn(),
}));
jest.mock("../../util/auth", () => ({
  requestPasswordReset: jest.fn(),
  resendVerificationEmail: jest.fn(),
}));
// The real hook reaches profile-context and, through it, AsyncStorage — the
// same jest.mock gap the other screen suites work around.
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { openSupportEmail } from "../../util/openSupportEmail";
import {
  requestPasswordReset,
  resendVerificationEmail,
} from "../../util/auth";
import { createRouteMock } from "../test-utils";
import CheckEmailScreen from "../CheckEmailScreen";

const mockShowErrorToast = jest.fn();
let mockRoute: ReturnType<typeof createRouteMock>;

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders nothing when no email param was passed", async () => {
  mockRoute = createRouteMock("CheckEmail", {});
  const result = await render(<CheckEmailScreen />);
  expect(result.toJSON()).toBeNull();
});

it("shows the confirmation message with the email and opens support on tap", async () => {
  mockRoute = createRouteMock("CheckEmail", { email: "jane@example.com" });
  await render(<CheckEmailScreen />);

  expect(
    screen.getByText('confirmation_sent_to:{"email":"jane@example.com"}'),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("verification_sent_link"));
  expect(openSupportEmail).toHaveBeenCalledTimes(1);
});

// The screen serves both letters the app can cause, and "send it again" has to
// hit the endpoint that produced the one being waited for — a resend of the
// signup letter would tell a person waiting for a reset link that their
// address is already confirmed.
it("resends the signup confirmation by default", async () => {
  mockRoute = createRouteMock("CheckEmail", { email: "jane@example.com" });
  await render(<CheckEmailScreen />);

  await fireEvent.press(screen.getByTestId("resend-letter-button"));

  await waitFor(() =>
    expect(resendVerificationEmail).toHaveBeenCalledWith("jane@example.com"),
  );
  expect(requestPasswordReset).not.toHaveBeenCalled();
});

it("asks for another reset link in reset mode", async () => {
  mockRoute = createRouteMock("CheckEmail", {
    email: "jane@example.com",
    mode: "reset",
  });
  await render(<CheckEmailScreen />);

  expect(
    screen.getByText('reset_link_sent_to:{"email":"jane@example.com"}'),
  ).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId("resend-letter-button"));

  await waitFor(() =>
    expect(requestPasswordReset).toHaveBeenCalledWith("jane@example.com"),
  );
  expect(resendVerificationEmail).not.toHaveBeenCalled();
});

it("reports a failed resend instead of claiming the letter went out", async () => {
  mockRoute = createRouteMock("CheckEmail", { email: "jane@example.com" });
  (resendVerificationEmail as jest.Mock).mockRejectedValue(new Error("nope"));
  await render(<CheckEmailScreen />);

  await fireEvent.press(screen.getByTestId("resend-letter-button"));

  await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
});
