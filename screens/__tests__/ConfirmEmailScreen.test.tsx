jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../util/fetches", () => ({
  sendConfirmEmail: jest.fn(),
}));
jest.mock("../../services/errors", () => ({
  logError: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { sendConfirmEmail } from "../../util/fetches";
import { createNavigationMock, createRouteMock } from "../test-utils";
import ConfirmEmailScreen from "../ConfirmEmailScreen";

const mockNavigation = createNavigationMock();
let mockRoute: ReturnType<typeof createRouteMock>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = createRouteMock("ConfirmEmail", { key: "abc123" });
});

it("confirms the email on mount and navigates to Login on success", async () => {
  (sendConfirmEmail as jest.Mock).mockResolvedValue({
    status: 200,
    data: { email: "jane@example.com" },
  });
  await render(<ConfirmEmailScreen />);

  await waitFor(() =>
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Login", {
      emailConfirmed: true,
      prefillEmail: "jane@example.com",
    }),
  );
  expect(sendConfirmEmail).toHaveBeenCalledWith("abc123");
});

it("shows a generic error when the confirmation response isn't 200, with retry", async () => {
  (sendConfirmEmail as jest.Mock).mockResolvedValue({ status: 400 });
  await render(<ConfirmEmailScreen />);

  await waitFor(() => expect(screen.getByText("email_confirmation_failed")).toBeOnTheScreen());
  expect(mockNavigation.navigate).not.toHaveBeenCalled();

  (sendConfirmEmail as jest.Mock).mockClear();
  await fireEvent.press(screen.getByText("try_again"));
  await waitFor(() => expect(sendConfirmEmail).toHaveBeenCalledTimes(1));
});

it("prefers the server's detail/message over the generic error on a thrown failure", async () => {
  (sendConfirmEmail as jest.Mock).mockRejectedValue({
    response: { data: { detail: "Link expired" } },
  });
  await render(<ConfirmEmailScreen />);

  await waitFor(() => expect(screen.getByText("Link expired")).toBeOnTheScreen());
});

it("falls back to the generic error when the thrown failure has no detail/message", async () => {
  (sendConfirmEmail as jest.Mock).mockRejectedValue({ response: { data: {} } });
  await render(<ConfirmEmailScreen />);

  await waitFor(() => expect(screen.getByText("email_confirmation_failed")).toBeOnTheScreen());
});
