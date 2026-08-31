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
jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown[] }) =>
    options.queryKey[0] === "mySocialAccounts" ? mockAccountsQuery : mockProfileQuery,
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn() },
}));
jest.mock("../../util/auth", () => ({
  connectGoogle: jest.fn(),
  connectApple: jest.fn(),
}));
jest.mock("../../util/fetches", () => ({
  fetchMySocialAccounts: jest.fn(),
  fetchMyProfile: jest.fn(),
  disconnectSocialAccount: jest.fn(),
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(async () => true),
}));

import { Platform } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { BottomSheet } from "../../services/bottomSheet";
import { connectApple, connectGoogle } from "../../util/auth";
import { disconnectSocialAccount } from "../../util/fetches";
import { SocialAccountItem } from "../../types";
import LinkedAccountsScreen from "../LinkedAccountsScreen";

const mockShowErrorToast = jest.fn();
let mockAccountsQuery: Record<string, unknown>;
let mockProfileQuery: Record<string, unknown>;

const google: SocialAccountItem = {
  id: 11,
  provider: "google",
  provider_user_id: "g-1",
  email: "jane@example.com",
  last_login: "2026-08-01T00:00:00Z",
  date_joined: "2026-01-01T00:00:00Z",
};
const apple: SocialAccountItem = {
  id: 12,
  provider: "apple",
  provider_user_id: "a-1",
  email: null,
  last_login: "2026-08-01T00:00:00Z",
  date_joined: "2026-01-01T00:00:00Z",
};

const accountsQuery = (data: SocialAccountItem[]) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  isRefetching: false,
});

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = "ios";
  mockAccountsQuery = accountsQuery([google]);
  mockProfileQuery = { data: { has_usable_password: true } };
  (connectGoogle as jest.Mock).mockResolvedValue(true);
  (connectApple as jest.Mock).mockResolvedValue(true);
});

it("lists a connected provider with the address it carries", async () => {
  await render(<LinkedAccountsScreen />);

  expect(screen.getByText("Google")).toBeOnTheScreen();
  expect(screen.getByText("jane@example.com")).toBeOnTheScreen();
});

it("says so when nothing is connected", async () => {
  mockAccountsQuery = accountsQuery([]);
  await render(<LinkedAccountsScreen />);

  expect(screen.getByText("linked_accounts_empty")).toBeOnTheScreen();
});

describe("which providers can still be added", () => {
  it("does not offer to connect one that already is", async () => {
    await render(<LinkedAccountsScreen />);

    expect(screen.queryByTestId("social-connect-google")).not.toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByTestId("social-connect-apple")).toBeOnTheScreen(),
    );
  });

  // The app carries no Apple SDK off iOS, so the button would open nothing.
  it("hides Apple on Android", async () => {
    Platform.OS = "android";
    await render(<LinkedAccountsScreen />);

    expect(screen.queryByTestId("social-connect-apple")).not.toBeOnTheScreen();
  });
});

describe("connecting", () => {
  it("connects Google and says so", async () => {
    mockAccountsQuery = accountsQuery([apple]);
    await render(<LinkedAccountsScreen />);

    await fireEvent.press(screen.getByTestId("social-connect-google"));

    await waitFor(() => expect(connectGoogle).toHaveBeenCalled());
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: 'linked_account_connected:{"provider":"Google"}',
      }),
    );
  });

  // Backing out of the provider's own dialog changed nothing, so claiming
  // "Google linked" would be a plain lie.
  it("stays quiet when the person backs out of the provider dialog", async () => {
    mockAccountsQuery = accountsQuery([apple]);
    (connectGoogle as jest.Mock).mockResolvedValue(false);
    await render(<LinkedAccountsScreen />);

    await fireEvent.press(screen.getByTestId("social-connect-google"));

    await waitFor(() => expect(connectGoogle).toHaveBeenCalled());
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("reports a refusal from the server", async () => {
    mockAccountsQuery = accountsQuery([apple]);
    (connectGoogle as jest.Mock).mockRejectedValue({
      response: { data: { detail: "already linked elsewhere" } },
    });
    await render(<LinkedAccountsScreen />);

    await fireEvent.press(screen.getByTestId("social-connect-google"));

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
  });
});

describe("disconnecting", () => {
  it("asks first and disconnects only on confirm", async () => {
    await render(<LinkedAccountsScreen />);

    await fireEvent.press(screen.getByTestId(`social-disconnect-${google.id}`));

    expect(disconnectSocialAccount).not.toHaveBeenCalled();
    const sheet = (BottomSheet.show as jest.Mock).mock.calls.at(-1)![0];
    await act(async () => sheet.onConfirm());

    expect(disconnectSocialAccount).toHaveBeenCalledWith(google.id);
  });

  // The server refuses this outright; the warning just says so before the tap
  // rather than after.
  it("warns when the only provider is also the only way in", async () => {
    mockProfileQuery = { data: { has_usable_password: false } };
    await render(<LinkedAccountsScreen />);

    expect(screen.getByText("linked_accounts_last_way_in")).toBeOnTheScreen();
  });

  it("does not warn while a password exists as a fallback", async () => {
    await render(<LinkedAccountsScreen />);

    expect(
      screen.queryByText("linked_accounts_last_way_in"),
    ).not.toBeOnTheScreen();
  });

  it("does not warn while a second provider remains", async () => {
    mockAccountsQuery = accountsQuery([google, apple]);
    mockProfileQuery = { data: { has_usable_password: false } };
    await render(<LinkedAccountsScreen />);

    expect(
      screen.queryByText("linked_accounts_last_way_in"),
    ).not.toBeOnTheScreen();
  });
});
