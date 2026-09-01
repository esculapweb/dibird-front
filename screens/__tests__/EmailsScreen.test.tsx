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
  useQuery: () => mockQuery,
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn(), showMenu: jest.fn(), hide: jest.fn() },
}));
jest.mock("../../util/fetches", () => ({
  fetchMyEmails: jest.fn(),
  addMyEmail: jest.fn(),
  deleteMyEmail: jest.fn(),
  setMyPrimaryEmail: jest.fn(),
  resendMyEmailConfirmation: jest.fn(),
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { BottomSheet } from "../../services/bottomSheet";
import {
  addMyEmail,
  deleteMyEmail,
  resendMyEmailConfirmation,
  setMyPrimaryEmail,
} from "../../util/fetches";
import { EmailAddressItem } from "../../types";
import { TestMenuItem, overflowRow } from "../test-utils";
import EmailsScreen from "../EmailsScreen";

const mockShowErrorToast = jest.fn();
let mockQuery: Record<string, unknown>;

const primary: EmailAddressItem = {
  id: 1,
  email: "jane@example.com",
  verified: true,
  primary: true,
};
const confirmedSecond: EmailAddressItem = {
  id: 2,
  email: "second@example.com",
  verified: true,
  primary: false,
};
const unconfirmedSecond: EmailAddressItem = {
  id: 3,
  email: "third@example.com",
  verified: false,
  primary: false,
};

const listQuery = (data: EmailAddressItem[]) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  isRefetching: false,
});

/**
 * Opens the "⋯" menu of one row and returns the actions offered there.
 *
 * Their `onPress` is a bare callback rather than a rendered element, so a test
 * pressing one has to wrap it in `act()` itself — the screen sets state around
 * every request.
 */
const menuFor = async (item: EmailAddressItem): Promise<TestMenuItem[]> => {
  await fireEvent.press(screen.getByTestId(`email-row-${item.id}`));
  const call = (BottomSheet.showMenu as jest.Mock).mock.calls.at(-1);
  return call ? (call[0].items as TestMenuItem[]) : [];
};

const labels = (items: TestMenuItem[]) => items.map((item) => item.label);

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery = listQuery([primary, confirmedSecond, unconfirmedSecond]);
});

it("shows each address with its state", async () => {
  await render(<EmailsScreen />);

  expect(screen.getByText("jane@example.com")).toBeOnTheScreen();
  expect(screen.getAllByText("email_badge_primary")).toHaveLength(1);
  expect(screen.getAllByText("email_badge_verified")).toHaveLength(2);
  expect(screen.getAllByText("email_badge_unverified")).toHaveLength(1);
});

// The server refuses each of these, so offering them would only ever produce
// a 400 — the menu mirrors the same rules the website's form enforces.
describe("which actions a row offers", () => {
  it("does not offer to remove or re-primary the primary address", async () => {
    await render(<EmailsScreen />);

    expect(labels(await menuFor(primary))).toEqual([]);
  });

  it("offers make-primary and remove for a confirmed secondary", async () => {
    await render(<EmailsScreen />);

    expect(labels(await menuFor(confirmedSecond))).toEqual([
      "email_make_primary",
      "remove",
    ]);
  });

  it("offers resend, not make-primary, for an unconfirmed one", async () => {
    await render(<EmailsScreen />);

    expect(labels(await menuFor(unconfirmedSecond))).toEqual([
      "email_resend_confirmation",
      "remove",
    ]);
  });

  it("does not offer to remove the only address, primary or not", async () => {
    const only = { ...confirmedSecond, primary: false };
    mockQuery = listQuery([only]);
    await render(<EmailsScreen />);

    expect(labels(await menuFor(only))).toEqual(["email_make_primary"]);
  });
});

describe("the actions themselves", () => {
  it("makes a confirmed address primary", async () => {
    await render(<EmailsScreen />);

    const row = overflowRow(await menuFor(confirmedSecond), "email_make_primary");
    await act(async () => row.onPress());

    await waitFor(() =>
      expect(setMyPrimaryEmail).toHaveBeenCalledWith(confirmedSecond.id),
    );
  });

  it("resends the confirmation letter", async () => {
    await render(<EmailsScreen />);

    const row = overflowRow(
      await menuFor(unconfirmedSecond),
      "email_resend_confirmation",
    );
    await act(async () => row.onPress());

    await waitFor(() =>
      expect(resendMyEmailConfirmation).toHaveBeenCalledWith(
        unconfirmedSecond.id,
      ),
    );
  });

  // A menu row does not close the sheet on its own: an action that only shows
  // a toast has to, or the menu stays on screen over its own result.
  it("closes the menu before an action that ends in a toast", async () => {
    await render(<EmailsScreen />);

    const row = overflowRow(
      await menuFor(unconfirmedSecond),
      "email_resend_confirmation",
    );
    await act(async () => row.onPress());

    expect(BottomSheet.hide).toHaveBeenCalled();
  });

  // Removing an address is not undoable, so it goes through the confirm sheet
  // rather than straight off the menu row.
  it("asks before removing, and removes only on confirm", async () => {
    await render(<EmailsScreen />);

    overflowRow(await menuFor(confirmedSecond), "remove").onPress();

    expect(deleteMyEmail).not.toHaveBeenCalled();
    // Not hidden first: the confirmation is presented over the open menu, and
    // a dismiss racing that swap can leave nothing on screen at all.
    expect(BottomSheet.hide).not.toHaveBeenCalled();
    const sheet = (BottomSheet.show as jest.Mock).mock.calls.at(-1)![0];
    await act(async () => sheet.onConfirm());

    expect(deleteMyEmail).toHaveBeenCalledWith(confirmedSecond.id);
  });
});

describe("adding an address", () => {
  it("posts a valid address", async () => {
    await render(<EmailsScreen />);

    await fireEvent.changeText(
      screen.getByTestId("add-email-input"),
      "  new@example.com  ",
    );
    await fireEvent.press(screen.getByTestId("add-email-button"));

    await waitFor(() =>
      expect(addMyEmail).toHaveBeenCalledWith("new@example.com"),
    );
  });

  it("does not post something that is not an address", async () => {
    await render(<EmailsScreen />);

    await fireEvent.changeText(screen.getByTestId("add-email-input"), "nope");
    await fireEvent.press(screen.getByTestId("add-email-button"));

    expect(addMyEmail).not.toHaveBeenCalled();
  });

  it("reports a refusal from the server", async () => {
    (addMyEmail as jest.Mock).mockRejectedValue({
      response: { data: { email: ["already in use"] } },
    });
    await render(<EmailsScreen />);

    await fireEvent.changeText(
      screen.getByTestId("add-email-input"),
      "taken@example.com",
    );
    await fireEvent.press(screen.getByTestId("add-email-button"));

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());
  });
});
