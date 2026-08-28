jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  // services/i18n.ts's real i18n.use(initReactI18next).init(...) still runs
  // at import time (util/helpers.ts -> services/i18n.ts, pulled in
  // transitively by NotificationCard.tsx) — this stub keeps that call from
  // choking on an undefined plugin once react-i18next itself is mocked.
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
// @expo/vector-icons pulls in expo-font -> expo-asset, unresolvable from
// this project's node_modules layout under jest — same stub as
// components/Profile/__tests__/FailedEditBanner.test.tsx.
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
// Layout only provides chrome (background scene via react-native-svg,
// safe-area, keyboard-aware scroll) irrelevant to this screen's own logic
// — stub to a passthrough so tests don't have to deal with react-native-svg.
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock("../../util/fetches", () => ({
  fetchNotifications: jest.fn(),
  markNotificationsRead: jest.fn(),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { markNotificationsRead } from "../../util/fetches";
import { UNREAD_COUNT_KEY } from "../../hooks/useUnreadCount";
import { AppNotification } from "../../types";
import { createNavigationMock } from "../test-utils";
import NotificationsScreen from "../NotificationsScreen";

const mockNavigation = createNavigationMock();
const mockInvalidateQueries = jest.fn();

const notification = (overrides: Partial<AppNotification> = {}): AppNotification => ({
  id: 1,
  type: "system",
  title: "Title",
  body: "Body",
  data: {},
  is_read: false,
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const mockQuery = (overrides: Record<string, unknown> = {}) => {
  (useInfiniteQuery as jest.Mock).mockReturnValue({
    data: { pages: [] },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries: mockInvalidateQueries });
  (markNotificationsRead as jest.Mock).mockResolvedValue(undefined);
  mockQuery();
});

it("shows a loading indicator while the first page is loading", async () => {
  mockQuery({ isLoading: true });
  await render(<NotificationsScreen />);
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});

it("renders notifications flattened from all pages", async () => {
  mockQuery({
    data: {
      pages: [
        { results: [notification({ id: 1, title: "First" })] },
        { results: [notification({ id: 2, title: "Second" })] },
      ],
    },
  });
  await render(<NotificationsScreen />);
  expect(screen.getByText("First")).toBeOnTheScreen();
  expect(screen.getByText("Second")).toBeOnTheScreen();
});

it("shows the empty state when there are no notifications", async () => {
  await render(<NotificationsScreen />);
  expect(screen.getByText("no_notifications")).toBeOnTheScreen();
});

it("mark-all-read posts, then invalidates both the notifications and unread-count queries", async () => {
  await render(<NotificationsScreen />);
  const headerRight = (mockNavigation.setOptions as jest.Mock).mock.calls[0][0].headerRight;
  await render(headerRight());

  await fireEvent.press(screen.getByText("mark_all_read"));

  expect(markNotificationsRead).toHaveBeenCalledWith();
  expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: UNREAD_COUNT_KEY });
});

it("marks an unread item read and invalidates on tap, but no-ops for an already-read item", async () => {
  mockQuery({
    data: {
      pages: [
        {
          results: [
            notification({ id: 1, title: "Unread", is_read: false }),
            notification({ id: 2, title: "Read", is_read: true }),
          ],
        },
      ],
    },
  });
  await render(<NotificationsScreen />);

  await fireEvent.press(screen.getByText("Read"));
  expect(markNotificationsRead).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText("Unread"));
  expect(markNotificationsRead).toHaveBeenCalledWith([1]);
  expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["notifications"] });
});

describe("tap routing", () => {
  const cases: Array<[AppNotification["data"], unknown[]]> = [
    [{ screen: "Community", highlightObsIds: [1, 2] }, ["Community", { highlightObsIds: [1, 2] }]],
    [{ screen: "CommunityDetail", obsId: 5 }, ["CommunityDetail", { observationId: 5 }]],
    [
      { screen: "SpeciesDetail", speciesId: 7 },
      ["SpeciesDetail", { id: 7, source: "notification" }],
    ],
    [{ screen: "Achievements", achievementId: "a1" }, ["Achievements", { highlightId: "a1" }]],
    // The params are passed explicitly, not left off, since the routing moved
    // to the shared util/notificationRoute — same navigation either way.
    [{ screen: "Checklist" }, ["Checklist", undefined]],
    [{ screen: "Notifications" }, ["Notifications", undefined]],
  ];

  it.each(cases)("routes %o to navigate(%p)", async (data, expectedArgs) => {
    mockQuery({
      data: { pages: [{ results: [notification({ id: 1, title: "Item", is_read: true, data })] }] },
    });
    await render(<NotificationsScreen />);

    await fireEvent.press(screen.getByText("Item"));

    expect(mockNavigation.navigate).toHaveBeenCalledWith(...expectedArgs);
  });

  it("does nothing for an unknown screen value", async () => {
    mockQuery({
      data: {
        pages: [{ results: [notification({ id: 1, title: "Item", is_read: true, data: { screen: "Unknown" } })] }],
      },
    });
    await render(<NotificationsScreen />);

    await fireEvent.press(screen.getByText("Item"));

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});

it("does not fetch the next page when none is available", async () => {
  const fetchNextPage = jest.fn();
  mockQuery({
    data: { pages: [{ results: [notification()] }] },
    hasNextPage: false,
    fetchNextPage,
  });
  await render(<NotificationsScreen />);
  screen.getByTestId("items-list").props.onEndReached();
  expect(fetchNextPage).not.toHaveBeenCalled();
});

it("fetches the next page when one is available", async () => {
  const fetchNextPage = jest.fn();
  mockQuery({
    data: { pages: [{ results: [notification()] }] },
    hasNextPage: true,
    fetchNextPage,
  });
  await render(<NotificationsScreen />);
  screen.getByTestId("items-list").props.onEndReached();
  expect(fetchNextPage).toHaveBeenCalledTimes(1);
});
