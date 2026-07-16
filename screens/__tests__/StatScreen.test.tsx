jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../util/fetches", () => ({
  fetchStat: jest.fn(),
  fetchChecklist: jest.fn(),
}));
jest.mock("../../store/filters-context", () => ({
  useFilters: jest.fn(),
}));
jest.mock("../../store/profile-context", () => ({
  useProfile: jest.fn(),
}));
jest.mock("../../util/parseDeepLinkParams", () => ({
  parseDeepLinkParams: jest.fn(() => ({ seenMode: null })),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn(), showMenu: jest.fn(), hide: jest.fn() },
}));
// speciesDetails is a Linking.openURL side effect (stubbed); buildShareUrl
// is real (pure, already covered elsewhere).
jest.mock("../../util/helpers", () => ({
  ...jest.requireActual("../../util/helpers"),
  speciesDetails: jest.fn(),
}));
jest.mock("../../components/Stats/StatCard", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, onToggle, onPress }: {
      item: { species_id: number };
      onToggle: () => void;
      onPress: () => void;
    }) => (
      <>
        <TouchableOpacity testID={`toggle-${item.species_id}`} onPress={onToggle}>
          <Text>toggle</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`menu-${item.species_id}`} onPress={onPress}>
          <Text>menu</Text>
        </TouchableOpacity>
      </>
    ),
  };
});
jest.mock("../../components/Stats/ChecklistCard", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, onToggle, onPress }: {
      item: { species_id: number };
      onToggle: () => void;
      onPress: () => void;
    }) => (
      <>
        <TouchableOpacity testID={`toggle-${item.species_id}`} onPress={onToggle}>
          <Text>toggle</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`menu-${item.species_id}`} onPress={onPress}>
          <Text>menu</Text>
        </TouchableOpacity>
      </>
    ),
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
const mockListScreenCapture = jest.fn();
jest.mock("../ListScreen", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockListScreenCapture(props);
    return null;
  },
}));

import { Share, Platform } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { fetchStat, fetchChecklist } from "../../util/fetches";
import { useFilters } from "../../store/filters-context";
import { useProfile } from "../../store/profile-context";
import { parseDeepLinkParams } from "../../util/parseDeepLinkParams";
import { BottomSheet } from "../../services/bottomSheet";
import { speciesDetails } from "../../util/helpers";
import { createNavigationMock, createRouteMock } from "../test-utils";
import StatScreen from "../StatScreen";

const mockNavigation = createNavigationMock();
let mockRoute: ReturnType<typeof createRouteMock>;
const mockSetSeenMode = jest.fn();
const originalOS = Platform.OS;
const latestProps = () => mockListScreenCapture.mock.calls.at(-1)![0];

const mockFiltersCtx = (overrides: Record<string, unknown> = {}) => {
  (useFilters as jest.Mock).mockReturnValue({
    territory: 5,
    seenMode: "all",
    setSeenMode: mockSetSeenMode,
    ...overrides,
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
  mockRoute = createRouteMock("Stat", {});
  mockFiltersCtx();
  (useProfile as jest.Mock).mockReturnValue({ profile: { user: 1, private: false } });
  (parseDeepLinkParams as jest.Mock).mockReturnValue({ seenMode: null });
});

afterEach(() => {
  Platform.OS = originalOS;
});

describe("view mode", () => {
  it("Stat route uses the stats config (fetchStat, sortable, personal StatCard)", async () => {
    await render(<StatScreen />);
    const props = latestProps();
    expect(props.title).toBe("statistics");
    expect(props.errorTitle).toBe("stat_unavailable");
    expect(props.allowSort).toBe(true);
    expect(typeof props.handleSharePress).toBe("function");
  });

  it("Checklist route uses the checklist config (fetchChecklist, not sortable, no share)", async () => {
    mockRoute = createRouteMock("Checklist", {});
    await render(<StatScreen />);
    const props = latestProps();
    expect(props.title).toBe("checklist");
    expect(props.errorTitle).toBe("checklist_unavailable");
    expect(props.allowSort).toBe(false);
    expect(props.handleSharePress).toBeUndefined();
  });
});

it("applies an initial seenMode from deep-link params on mount, then clears the param", async () => {
  (parseDeepLinkParams as jest.Mock).mockReturnValue({ seenMode: "unseen" });
  await render(<StatScreen />);
  expect(mockSetSeenMode).toHaveBeenCalledWith("unseen");
  expect(mockNavigation.setParams).toHaveBeenCalledWith({ seenMode: undefined });
});

describe("fetchFunction (fetchData)", () => {
  it("checklist mode short-circuits to an empty page without territory", async () => {
    mockRoute = createRouteMock("Checklist", {});
    await render(<StatScreen />);
    const result = await latestProps().fetchFunction({}, null, "", 1);
    expect(result.results).toEqual([]);
    expect(fetchChecklist).not.toHaveBeenCalled();
  });

  it("stats mode short-circuits to an empty page without territory unless viewing 'seen'", async () => {
    mockFiltersCtx({ seenMode: "all" });
    await render(<StatScreen />);
    await latestProps().fetchFunction({}, null, "", 1);
    expect(fetchStat).not.toHaveBeenCalled();

    mockFiltersCtx({ seenMode: "seen" });
    await render(<StatScreen />);
    await latestProps().fetchFunction({}, null, "", 1);
    expect(fetchStat).toHaveBeenCalledWith({ seen: true }, null, "", 1);
  });

  it("derives safeFilters.seen from seenMode when a territory is set", async () => {
    mockFiltersCtx({ seenMode: "unseen" });
    await render(<StatScreen />);
    await latestProps().fetchFunction({ territory: 5 }, "name", "sparrow", 2);
    expect(fetchStat).toHaveBeenCalledWith({ territory: 5, seen: false }, "name", "sparrow", 2);
  });
});

it("customHeaderBadge formats 'seen / total' when both counts are numbers, else undefined", async () => {
  await render(<StatScreen />);
  const { customHeaderBadge } = latestProps();
  expect(customHeaderBadge({ seen_species: 4, total_species: 9 })).toBe("4 / 9");
  expect(customHeaderBadge({})).toBeUndefined();
});

describe("noItems", () => {
  it("prompts to select a territory for checklist mode without one, wired to the registered filter opener", async () => {
    mockRoute = createRouteMock("Checklist", {});
    await render(<StatScreen />);
    const openFilterModal = jest.fn();
    latestProps().onOpenFilterModal(openFilterModal);

    const { noItems } = latestProps();
    expect(noItems.message).toBe("select_territory_to_view_checklist");
    noItems.actions[0].onPress();
    expect(openFilterModal).toHaveBeenCalledTimes(1);
  });

  it("prompts to select a territory for stats mode outside 'seen', with a message keyed by seenMode", async () => {
    mockFiltersCtx({ seenMode: "unseen" });
    await render(<StatScreen />);
    expect(latestProps().noItems.message).toBe("select_territory_to_view_not_seen");

    mockFiltersCtx({ seenMode: "all" });
    await render(<StatScreen />);
    expect(latestProps().noItems.message).toBe("select_territory_to_view_all");
  });

  it("falls back to the mode's default empty message otherwise", async () => {
    mockFiltersCtx({ seenMode: "seen" });
    await render(<StatScreen />);
    expect(latestProps().noItems.message).toBe("no_stat_yet");
    expect(latestProps().noItems.actions[0].label).toBe("add_first_observation");
  });
});

describe("handleStatCardPress (StatCard's onToggle)", () => {
  it("an unseen item navigates straight to a pre-filled ObservationEditor", async () => {
    await render(<StatScreen />);
    await render(latestProps().renderItem({ item: { species_id: 1, seen: false }, index: 0 }));
    await fireEvent.press(await require("@testing-library/react-native").screen.getByTestId("toggle-1"));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", expect.objectContaining({
      defaultSpecies: 1,
      returnMode: "back",
    }));
  });

  it("a seen item in checklist mode shows the uncheck-warning sheet before navigating to its observations", async () => {
    mockRoute = createRouteMock("Checklist", {});
    await render(<StatScreen />);
    const { getByTestId } = await render(latestProps().renderItem({ item: { species_id: 1, seen: true }, index: 0 }));
    await fireEvent.press(getByTestId("toggle-1"));

    expect(BottomSheet.show).toHaveBeenCalledWith(expect.objectContaining({ title: "uncheck_title" }));
    const { onConfirm } = (BottomSheet.show as jest.Mock).mock.calls[0][0];
    onConfirm();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Observations", expect.objectContaining({
      filtersOverride: expect.objectContaining({ species: 1 }),
    }));
  });

  it("a seen item in stats mode navigates straight to its observations, no warning sheet", async () => {
    await render(<StatScreen />);
    const { getByTestId } = await render(latestProps().renderItem({ item: { species_id: 1, seen: true }, index: 0 }));
    await fireEvent.press(getByTestId("toggle-1"));

    expect(BottomSheet.show).not.toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Observations", expect.objectContaining({
      filtersOverride: expect.objectContaining({ species: 1 }),
    }));
  });
});

describe("handleBottomSheetMenu (StatCard's onPress)", () => {
  it("offers 'view observations' for a seen item and 'add observation' for an unseen one, plus species details always", async () => {
    await render(<StatScreen />);
    const { getByTestId } = await render(latestProps().renderItem({ item: { species_id: 1, seen: true, segment: "sparrow" }, index: 0 }));
    await fireEvent.press(getByTestId("menu-1"));

    const { items } = (BottomSheet.showMenu as jest.Mock).mock.calls[0][0];
    expect(items).toHaveLength(2);
    expect(items[0].label).toBe("view_species_observations");
    items[1].onPress();
    expect(speciesDetails).toHaveBeenCalledWith("sparrow");
  });

  it("unseen item's menu entry navigates to a pre-filled ObservationEditor", async () => {
    await render(<StatScreen />);
    const { getByTestId } = await render(latestProps().renderItem({ item: { species_id: 2, seen: false, segment: "robin" }, index: 0 }));
    await fireEvent.press(getByTestId("menu-2"));

    const { items } = (BottomSheet.showMenu as jest.Mock).mock.calls[0][0];
    expect(items[0].label).toBe("add_observation");
    items[0].onPress();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", expect.objectContaining({
      defaultSpecies: 2,
    }));
  });
});

describe("handleShare", () => {
  it("does nothing without a signed-in profile", async () => {
    (useProfile as jest.Mock).mockReturnValue({ profile: {} });
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    await render(<StatScreen />);
    await latestProps().handleSharePress();
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it("shows a privacy toast instead of sharing a private profile", async () => {
    (useProfile as jest.Mock).mockReturnValue({ profile: { user: 1, private: true } });
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    await render(<StatScreen />);
    await latestProps().handleSharePress();

    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: "profile_private" }));
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it("shares a platform-appropriate stat url otherwise", async () => {
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    Platform.OS = "ios";
    await render(<StatScreen />);
    await latestProps().handleSharePress();
    expect(shareSpy).toHaveBeenCalledWith({ url: expect.stringContaining("users/stat/1/") });
  });
});
