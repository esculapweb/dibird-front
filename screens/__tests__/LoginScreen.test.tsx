jest.mock("@react-navigation/native", () => ({
  useRoute: () => mockRoute,
}));
jest.mock("../../util/auth", () => ({
  Login: jest.fn(),
}));
jest.mock("../../store/auth-context", () => ({
  useAuth: () => ({ authenticate: mockAuthenticate }),
}));
jest.mock("../../components/Auth/AuthContent", () => {
  const { View, Text, TouchableOpacity } = require("react-native");
  return {
    __esModule: true,
    default: ({ onAuthenticate, loading, emailConfirmed, prefillEmail }: {
      onAuthenticate: (data: { email: string; password: string }) => Promise<void>;
      loading: boolean;
      emailConfirmed?: boolean;
      prefillEmail?: string;
    }) => (
      <View>
        <Text>{loading ? "auth-loading" : "auth-idle"}</Text>
        <Text>{`emailConfirmed:${!!emailConfirmed}`}</Text>
        <Text>{`prefillEmail:${prefillEmail ?? ""}`}</Text>
        <TouchableOpacity
          testID="submit-auth"
          onPress={() => onAuthenticate({ email: "jane@example.com", password: "hunter2" })}
        >
          <Text>submit</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { Login } from "../../util/auth";
import { createRouteMock } from "../test-utils";
import LoginScreen from "../LoginScreen";

const mockAuthenticate = jest.fn();
let mockRoute: ReturnType<typeof createRouteMock>;

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = createRouteMock("Login", {});
});

it("passes emailConfirmed/prefillEmail route params through to AuthContent", async () => {
  mockRoute = createRouteMock("Login", { emailConfirmed: true, prefillEmail: "jane@example.com" });
  await render(<LoginScreen />);

  expect(screen.getByText("emailConfirmed:true")).toBeOnTheScreen();
  expect(screen.getByText("prefillEmail:jane@example.com")).toBeOnTheScreen();
});

it("logs in then authenticates with the returned token", async () => {
  (Login as jest.Mock).mockResolvedValue("access-token");
  await render(<LoginScreen />);

  await fireEvent.press(screen.getByTestId("submit-auth"));

  expect(Login).toHaveBeenCalledWith("jane@example.com", "hunter2");
  expect(mockAuthenticate).toHaveBeenCalledWith("access-token");
});
