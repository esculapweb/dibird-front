jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = require("react-native");
  return { BottomSheetView: View };
});

const mockAuthOptionsCapture = jest.fn();
jest.mock("../AuthOptions", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockAuthOptionsCapture(props);
    return null;
  },
}));

import { fireEvent, render, screen } from "@testing-library/react-native";

import AuthGateSheet from "../AuthGateSheet";

const mockDismiss = jest.fn();
const mockOnEmailPress = jest.fn();
const mockOnOpenDocument = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

const renderSheet = () =>
  render(
    <AuthGateSheet
      dismiss={mockDismiss}
      onEmailPress={mockOnEmailPress}
      onOpenDocument={mockOnOpenDocument}
    />,
  );

const authOptionsProps = () =>
  mockAuthOptionsCapture.mock.calls.at(-1)![0] as {
    onEmailPress: () => void;
    onAuthenticated?: () => void;
  };

it("explains what the account is for and offers every way in", async () => {
  await renderSheet();

  expect(screen.getByText("auth_required_title")).toBeOnTheScreen();
  expect(screen.getByText("auth_required_message")).toBeOnTheScreen();
  expect(mockAuthOptionsCapture).toHaveBeenCalled();
});

// Apple/Google sign-in goes to the backend with `?agree_terms=1` — links to the
// documents have to be right here, not only on Welcome.
it("shows the terms agreement with working links", async () => {
  await renderSheet();

  await fireEvent.press(screen.getByText("terms_of_service_"));
  expect(mockOnOpenDocument).toHaveBeenCalledWith("Terms");

  await fireEvent.press(screen.getByText("privacy_policy_"));
  expect(mockOnOpenDocument).toHaveBeenCalledWith("Privacy");
});

it("closes on cancel", async () => {
  await renderSheet();

  await fireEvent.press(screen.getByTestId("auth-gate-cancel-button"));

  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it("closes itself once the sign-in succeeds", async () => {
  await renderSheet();

  authOptionsProps().onAuthenticated?.();

  expect(mockDismiss).toHaveBeenCalledTimes(1);
});

it("passes the email option straight through to the caller", async () => {
  await renderSheet();

  authOptionsProps().onEmailPress();

  expect(mockOnEmailPress).toHaveBeenCalledTimes(1);
});
