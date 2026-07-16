jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("../../util/auth", () => ({
  CreateUser: jest.fn(),
}));
// AuthContent's own form (validation, password visibility, etc.) is a
// separately-testable widget unrelated to this screen's own job: wiring
// onAuthenticate to CreateUser + navigation. Stub exposes a trigger and the
// loading prop.
jest.mock("../../components/Auth/AuthContent", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  return {
    __esModule: true,
    default: ({ onAuthenticate, loading }: {
      onAuthenticate: (data: { email: string; password: string; userName?: string }) => Promise<void>;
      loading: boolean;
    }) => (
      <View>
        <Text>{loading ? "auth-loading" : "auth-idle"}</Text>
        <TouchableOpacity
          testID="submit-auth"
          onPress={async () => {
            try {
              await onAuthenticate({ email: "jane@example.com", password: "hunter2", userName: "jane" });
            } catch (e) {
              mockAuthError(e);
            }
          }}
        >
          <Text>submit</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { CreateUser } from "../../util/auth";
import { createNavigationMock } from "../test-utils";
import SignupScreen from "../SignupScreen";

const mockNavigation = createNavigationMock();
const mockAuthError = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

it("creates the user then navigates to CheckEmail with the entered email", async () => {
  (CreateUser as jest.Mock).mockResolvedValue(undefined);
  await render(<SignupScreen />);

  await fireEvent.press(screen.getByTestId("submit-auth"));

  expect(CreateUser).toHaveBeenCalledWith("jane@example.com", "hunter2", "jane");
  expect(mockNavigation.popToTop).toHaveBeenCalledTimes(1);
  expect(mockNavigation.navigate).toHaveBeenCalledWith("CheckEmail", { email: "jane@example.com" });
});

it("propagates a signup failure without navigating", async () => {
  (CreateUser as jest.Mock).mockRejectedValue(new Error("boom"));
  await render(<SignupScreen />);

  // signUpHandler re-throws on failure — AuthContent (real) is what would
  // normally catch+toast that; the stub catches it into mockAuthError
  // instead, so the rejection doesn't escape as an unhandled promise here.
  await fireEvent.press(screen.getByTestId("submit-auth"));

  expect(mockAuthError).toHaveBeenCalledWith(new Error("boom"));
  expect(mockNavigation.navigate).not.toHaveBeenCalled();
  expect(screen.getByText("auth-idle")).toBeOnTheScreen();
});
