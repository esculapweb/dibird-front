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
  useRoute: () => mockRoute,
}));
jest.mock("../../store/profile-context", () => ({
  useProfile: () => ({ profile: mockProfile }),
}));
jest.mock("../../util/fetches", () => ({
  sendContactMessage: jest.fn(),
}));
jest.mock("../../util/openSupportEmail", () => ({
  openSupportEmail: jest.fn(),
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
import { sendContactMessage } from "../../util/fetches";
import { openSupportEmail } from "../../util/openSupportEmail";
import { createNavigationMock, createRouteMock } from "../test-utils";
import ContactScreen from "../ContactScreen";

const mockNavigation = createNavigationMock();
const mockShowErrorToast = jest.fn();
let mockRoute: ReturnType<typeof createRouteMock>;
let mockProfile: unknown;

const fill = async (fields: Record<string, string>) => {
  for (const [field, value] of Object.entries(fields)) {
    await fireEvent.changeText(screen.getByTestId(`contact-${field}-input`), value);
  }
};

const MESSAGE = {
  name: "Jane",
  email: "jane@example.com",
  subject: "Wrong name",
  message: "The Russian name of the robin is off",
};

beforeEach(() => {
  jest.clearAllMocks();
  (sendContactMessage as jest.Mock).mockResolvedValue(undefined);
  mockRoute = createRouteMock("Contact", undefined);
  mockProfile = null;
});

it("sends the trimmed message and goes back", async () => {
  await render(<ContactScreen />);

  await fill({ ...MESSAGE, subject: "  Wrong name  " });
  await fireEvent.press(screen.getByTestId("contact-submit-button"));

  await waitFor(() => expect(sendContactMessage).toHaveBeenCalledWith(MESSAGE));
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: "success", text1: "contact_sent_title" }),
  );
  expect(mockNavigation.goBack).toHaveBeenCalled();
});

it("does not send with an empty field", async () => {
  await render(<ContactScreen />);

  await fill({ ...MESSAGE, message: "   " });
  await fireEvent.press(screen.getByTestId("contact-submit-button"));

  expect(sendContactMessage).not.toHaveBeenCalled();
  expect(screen.getByText("contact_field_required")).toBeOnTheScreen();
});

it("does not send with a malformed email", async () => {
  await render(<ContactScreen />);

  await fill({ ...MESSAGE, email: "jane@" });
  await fireEvent.press(screen.getByTestId("contact-submit-button"));

  expect(sendContactMessage).not.toHaveBeenCalled();
  expect(screen.getByText("contact_invalid_email")).toBeOnTheScreen();
});

it("fills in the name and email of a signed-in user", async () => {
  mockProfile = {
    user_data: {
      first_name: "Jane",
      last_name: "Doe",
      username: "jdoe",
      email: "jane@example.com",
    },
  };
  await render(<ContactScreen />);

  expect(screen.getByTestId("contact-name-input").props.value).toBe("Jane Doe");
  expect(screen.getByTestId("contact-email-input").props.value).toBe(
    "jane@example.com",
  );
});

// CheckEmail passes the address the letter did not reach — it wins over the
// profile, which a guest does not have anyway.
it("prefers the email passed by the route", async () => {
  mockRoute = createRouteMock("Contact", { prefillEmail: "new@example.com" });
  await render(<ContactScreen />);

  expect(screen.getByTestId("contact-email-input").props.value).toBe(
    "new@example.com",
  );
});

it("shows a server validation error under its field, without a toast", async () => {
  (sendContactMessage as jest.Mock).mockRejectedValue({
    status: 400,
    response: { data: { email: ["Enter a valid email address."] } },
  });
  await render(<ContactScreen />);

  await fill(MESSAGE);
  await fireEvent.press(screen.getByTestId("contact-submit-button"));

  expect(await screen.findByText("Enter a valid email address.")).toBeOnTheScreen();
  expect(mockShowErrorToast).not.toHaveBeenCalled();
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
});

// Offline or a 5xx: the common toast, and the typed text must survive for a
// second attempt — losing a long message to a dropped connection is the worst
// thing this screen can do.
it("keeps the text and shows the common toast on any other error", async () => {
  const error = { status: 0, isNetworkError: true };
  (sendContactMessage as jest.Mock).mockRejectedValue(error);
  await render(<ContactScreen />);

  await fill(MESSAGE);
  await fireEvent.press(screen.getByTestId("contact-submit-button"));

  await waitFor(() =>
    expect(mockShowErrorToast).toHaveBeenCalledWith(error, "ContactForm"),
  );
  expect(screen.getByTestId("contact-message-input").props.value).toBe(
    MESSAGE.message,
  );
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
});

// The server allows a few letters an hour; DRF's own 429 text counts the wait
// in seconds, so the screen says it in words instead.
it("explains the rate limit in its own words", async () => {
  (sendContactMessage as jest.Mock).mockRejectedValue({
    status: 429,
    response: { data: { detail: "Request was throttled. Expected available in 3540 seconds." } },
  });
  await render(<ContactScreen />);

  await fill(MESSAGE);
  await fireEvent.press(screen.getByTestId("contact-submit-button"));

  await waitFor(() =>
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", text1: "contact_too_many_title" }),
    ),
  );
  expect(mockShowErrorToast).not.toHaveBeenCalled();
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
});

it("still offers the mail app", async () => {
  await render(<ContactScreen />);

  await fireEvent.press(screen.getByTestId("contact-email-link"));

  expect(openSupportEmail).toHaveBeenCalledTimes(1);
});
