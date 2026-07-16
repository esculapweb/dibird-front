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
jest.mock("../../store/profile-context", () => ({
  useProfile: jest.fn(),
}));
jest.mock("../../services/errors", () => ({
  toUIError: jest.fn(),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useProfile } from "../../store/profile-context";
import { toUIError } from "../../services/errors";
import ErrorScreen from "../ErrorScreen";

const mockRefreshProfile = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders nothing when there is no profile error", async () => {
  (useProfile as jest.Mock).mockReturnValue({ error: null, refreshProfile: mockRefreshProfile });
  const result = await render(<ErrorScreen />);
  expect(result.toJSON()).toBeNull();
});

it("renders the translated error and retries via refreshProfile", async () => {
  const error = { code: "NETWORK_ERROR" };
  (useProfile as jest.Mock).mockReturnValue({ error, refreshProfile: mockRefreshProfile });
  (toUIError as jest.Mock).mockReturnValue({ title: "No connection", message: "Check your network" });

  await render(<ErrorScreen />);

  expect(toUIError).toHaveBeenCalledWith(error);
  expect(screen.getByText("No connection")).toBeOnTheScreen();
  expect(screen.getByText("Check your network")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("try_again"));
  expect(mockRefreshProfile).toHaveBeenCalledTimes(1);
});
