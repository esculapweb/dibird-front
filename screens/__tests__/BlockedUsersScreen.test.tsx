jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("../../util/fetches", () => ({ fetchBlockedUsers: jest.fn() }));
jest.mock("../../hooks/useModeration", () => ({
  useModeration: () => ({
    report: jest.fn(),
    block: jest.fn(),
    unblock: mockUnblock,
    isPending: false,
  }),
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
jest.mock("../../components/Profile/ProfileAvatar", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ username }: { username: string }) => (
      <Text>{`avatar:${username}`}</Text>
    ),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import BlockedUsersScreen from "../BlockedUsersScreen";

const mockUnblock = jest.fn();

const BLOCKED = {
  id: 3,
  blocked: 9,
  blocked_data: {
    id: 9,
    username: "jdoe",
    first_name: "Jane",
    last_name: "Doe",
    avatar: "a.jpg",
  },
  created_at: "2026-01-01T08:00:00Z",
};

const mockQuery = (overrides: Record<string, unknown> = {}) => {
  (useQuery as jest.Mock).mockReturnValue({
    data: [BLOCKED],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery();
});

it("lists who is blocked", async () => {
  await render(<BlockedUsersScreen />);

  expect(screen.getByText("Jane Doe")).toBeOnTheScreen();
  expect(screen.getByText("avatar:jdoe")).toBeOnTheScreen();
});

it("unblocks by profile id, not by the id of the block row", async () => {
  await render(<BlockedUsersScreen />);

  await fireEvent.press(screen.getByTestId("unblock-9"));

  expect(mockUnblock).toHaveBeenCalledWith(9);
});

it("says so when nobody is blocked", async () => {
  mockQuery({ data: [] });
  await render(<BlockedUsersScreen />);

  expect(screen.getByText("blocked_users_empty")).toBeOnTheScreen();
});

it("shows an error overlay when the list cannot be loaded", async () => {
  mockQuery({ data: undefined, isError: true, error: { message: "boom" } });
  await render(<BlockedUsersScreen />);

  expect(screen.getByText("boom")).toBeOnTheScreen();
});
