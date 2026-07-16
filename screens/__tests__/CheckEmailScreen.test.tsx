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

import { fireEvent, render, screen } from "@testing-library/react-native";
import { openSupportEmail } from "../../util/openSupportEmail";
import { createRouteMock } from "../test-utils";
import CheckEmailScreen from "../CheckEmailScreen";

let mockRoute: ReturnType<typeof createRouteMock>;

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
