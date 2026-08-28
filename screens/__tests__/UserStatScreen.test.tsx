jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@react-navigation/native", () => ({
  useRoute: () => mockRoute,
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));
jest.mock("../../util/fetches", () => ({
  fetchStat: jest.fn(),
  fetchUserProfile: jest.fn(),
}));
jest.mock("../../store/filters-context", () => ({
  useFilters: jest.fn(),
}));
jest.mock("../../hooks/useOpenSpecies", () => ({
  useOpenSpecies: () => mockOpenSpecies,
}));
jest.mock("../../components/Stats/StatCard", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, seenMode, onPress, onSpeciesPress }: {
      item: { segment: string };
      seenMode: string;
      onPress: () => void;
      onSpeciesPress: () => void;
    }) => (
      <>
        <TouchableOpacity testID="stat-card" onPress={onPress}>
          <Text>{`stat-card:${item.segment}:${seenMode}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="stat-card-thumb" onPress={onSpeciesPress}>
          <Text>thumb</Text>
        </TouchableOpacity>
      </>
    ),
  };
});
jest.mock("../../components/Profile/ProfileAvatar", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ username }: { username: string }) => <Text>{`avatar:${username}`}</Text>,
  };
});
jest.mock("../../components/ui/Tabs", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ tabOptions }: { tabOptions: Array<{ value: string; count?: number }> }) => (
      <Text>{tabOptions.map((o) => `${o.value}:${o.count ?? "none"}`).join(",")}</Text>
    ),
  };
});
const mockOpenSpecies = jest.fn();
const mockListScreenCapture = jest.fn();
jest.mock("../ListScreen", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockListScreenCapture(props);
    return null;
  },
}));

import { Share, Platform } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { fetchStat, fetchUserProfile } from "../../util/fetches";
import { useFilters } from "../../store/filters-context";
import { createRouteMock } from "../test-utils";
import UserStatScreen from "../UserStatScreen";

const mockRoute = createRouteMock("UserStat", { profileId: 9 });
const mockSetSeenMode = jest.fn();
const originalOS = Platform.OS;
const latestProps = () => mockListScreenCapture.mock.calls.at(-1)![0];

const mockFilters = (seenMode: string) => {
  (useFilters as jest.Mock).mockReturnValue({ seenMode, setSeenMode: mockSetSeenMode });
};

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
  mockFilters("all");
  (useQuery as jest.Mock).mockReturnValue({ data: undefined });
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("queries the user profile keyed by profileId, enabled only when it's present", async () => {
  await render(<UserStatScreen />);
  const call = (useQuery as jest.Mock).mock.calls[0][0];
  expect(call.queryKey).toEqual(["userProfile", 9]);
  expect(call.enabled).toBe(true);

  (fetchUserProfile as jest.Mock).mockResolvedValueOnce({});
  await call.queryFn();
  expect(fetchUserProfile).toHaveBeenCalledWith(9);
});

describe("fetchFunction (fetchData)", () => {
  it("short-circuits to an empty page without calling fetchStat when no territory filter and not viewing 'seen'", async () => {
    mockFilters("all");
    await render(<UserStatScreen />);
    const result = await latestProps().fetchFunction({}, null, "", 1);
    expect(result.results).toEqual([]);
    expect(fetchStat).not.toHaveBeenCalled();
  });

  it("still calls fetchStat with no territory when viewing 'seen'", async () => {
    mockFilters("seen");
    await render(<UserStatScreen />);
    await latestProps().fetchFunction({}, null, "", 1);
    expect(fetchStat).toHaveBeenCalledWith({ seen: true }, null, "", 1);
  });

  it("derives safeFilters.seen from seenMode when a territory is set", async () => {
    mockFilters("unseen");
    await render(<UserStatScreen />);
    await latestProps().fetchFunction({ territory: 5 }, "name", "sparrow", 2);
    expect(fetchStat).toHaveBeenCalledWith({ territory: 5, seen: false }, "name", "sparrow", 2);
  });
});

it("customHeaderBadge formats 'seen / total' when both counts are numbers, else undefined", async () => {
  await render(<UserStatScreen />);
  const { customHeaderBadge } = latestProps();
  expect(customHeaderBadge({ seen_species: 3, total_species: 10 })).toBe("3 / 10");
  expect(customHeaderBadge({})).toBeUndefined();
});

// Someone else's list has no "mark seen" of its own, so both the row and the
// picture lead to the same place.
it("renderItem opens the species page from the row and from the thumbnail alike", async () => {
  await render(<UserStatScreen />);
  await render(latestProps().renderItem({ item: { segment: "sparrow" }, index: 0 }));

  await fireEvent.press(screen.getByTestId("stat-card"));
  expect(mockOpenSpecies).toHaveBeenCalledWith("sparrow", "user_stat");

  mockOpenSpecies.mockClear();
  await fireEvent.press(screen.getByTestId("stat-card-thumb"));
  expect(mockOpenSpecies).toHaveBeenCalledWith("sparrow", "user_stat");
});

describe("topEl (profile header)", () => {
  it("renders nothing while the user profile hasn't loaded", async () => {
    (useQuery as jest.Mock).mockReturnValue({ data: undefined });
    await render(<UserStatScreen />);
    expect(latestProps().topEl).toBeFalsy();
  });

  it("renders the avatar/name once loaded", async () => {
    (useQuery as jest.Mock).mockReturnValue({
      data: { avatar: "a.jpg", user_data_public: { first_name: "Jane", last_name: "Doe", username: "jdoe" } },
    });
    await render(<UserStatScreen />);
    await render(latestProps().topEl);
    expect(screen.getByText("avatar:jdoe")).toBeOnTheScreen();
    expect(screen.getByText("Jane Doe")).toBeOnTheScreen();
  });
});

it("onFiltersChange without a territory (outside 'seen' mode) swaps noItems to a select-territory prompt wired to the registered filter-modal opener", async () => {
  await render(<UserStatScreen />);
  const openFilterModal = jest.fn();
  await act(async () => {
    latestProps().onOpenFilterModal(openFilterModal);
    await latestProps().onFiltersChange({});
  });

  const { noItems } = latestProps();
  expect(noItems.message).toBe("select_territory_to_view_not_seen");
  noItems.actions[0].onPress();
  expect(openFilterModal).toHaveBeenCalledTimes(1);
});

it("handleShare shares a platform-appropriate stat url", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
  Platform.OS = "android";
  await render(<UserStatScreen />);
  await latestProps().handleSharePress();
  expect(shareSpy).toHaveBeenCalledWith({ message: expect.stringContaining("users/stat/9") });
});
