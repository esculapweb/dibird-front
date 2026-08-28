jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  // The screen renders twice now (loading gate while the stored view mode is
  // read), and `(cb) => cb()` would re-fire the focus effect on every render.
  // The real useFocusEffect runs a stable callback once per focus.
  useFocusEffect: (cb: () => void) =>
    require("react").useEffect(() => {
      cb();
    }, [cb]),
}));
jest.mock("../../util/fetches", () => ({
  fetchDiaries: jest.fn(),
  fetchDiaryPlaces: jest.fn(),
  fetchOnlyDiaryAtPlace: jest.fn(),
}));
jest.mock("../../services/sync/diarySync", () => ({
  runDiarySync: jest.fn(),
}));
jest.mock("../../store/filters-context", () => ({
  useFilters: jest.fn(),
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => <Text>{name}</Text> };
});
jest.mock("../../util/storageHelper", () => ({
  loadViewMode: jest.fn(async () => null),
  saveViewMode: jest.fn(async () => {}),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { showMenu: jest.fn(), hide: jest.fn() },
}));
// The map drags in MapLibre and the native clipboard through MapL; this screen
// is only responsible for handing it the places and the scale.
jest.mock("../../components/Map/PlacesMap", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      places,
      scale,
    }: {
      places: { id: number }[];
      scale?: { countProperty: string };
    }) => <Text>{`map-${places.length}-${scale?.countProperty}`}</Text>,
  };
});
// DiaryCard is a separately-testable widget (its own useNavigation, image,
// sync-status icon) — this screen's own job is just picking which item type
// renders it and with what props.
jest.mock("../../components/Diary/DiaryCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, index }: { item: { id: number }; index: number }) => (
      <Text>{`diary-card-${item.id}-${index}`}</Text>
    ),
  };
});
// ListScreen itself is fully covered by ListScreen.test.tsx — mock it here
// to isolate DiariesScreen's own responsibility: computing the right props
// (fetchFunction/title/onAdd defaults) rather than re-testing the list shell.
const mockListScreenCapture = jest.fn();
jest.mock("../ListScreen", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockListScreenCapture(props);
    return null;
  },
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  fetchDiaries,
  fetchDiaryPlaces,
  fetchOnlyDiaryAtPlace,
} from "../../util/fetches";
import { runDiarySync } from "../../services/sync/diarySync";
import { useFilters } from "../../store/filters-context";
import { loadViewMode, saveViewMode } from "../../util/storageHelper";
import { BottomSheet } from "../../services/bottomSheet";
import { createNavigationMock, createRouteMock } from "../test-utils";
import DiariesScreen from "../DiariesScreen";

const lastProps = () => mockListScreenCapture.mock.calls.at(-1)![0];

const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("Diaries", {});

beforeEach(() => {
  jest.clearAllMocks();
  (useFilters as jest.Mock).mockReturnValue({ territory: 5 });
  (loadViewMode as jest.Mock).mockResolvedValue(null);
});

it("passes fetchDiaries and titles/errors through to ListScreen", async () => {
  await render(<DiariesScreen />);

  const props = mockListScreenCapture.mock.calls[0][0];
  expect(props.fetchFunction).toBe(fetchDiaries);
  expect(props.allowedFilters).toContain("private");
  expect(props.title).toBe("diaries");
  expect(props.errorTitle).toBe("diaries_unavailable");
});

it("retries the diary sync queue on focus", async () => {
  await render(<DiariesScreen />);
  expect(runDiarySync).toHaveBeenCalledTimes(1);
});

it("renders a DiaryCard for each item via renderItem", async () => {
  await render(<DiariesScreen />);
  const { renderItem } = mockListScreenCapture.mock.calls[0][0];
  const { getByText } = await render(renderItem({ item: { id: 7 }, index: 2 }));
  expect(getByText("diary-card-7-2")).toBeOnTheScreen();
});

describe("handleAdd defaults", () => {
  it("falls back to the global territory filter when no list filter is active yet", async () => {
    await render(<DiariesScreen />);
    const { onAdd } = mockListScreenCapture.mock.calls[0][0];
    await onAdd();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("DiaryEditor", {
      defaultTerritory: 5,
      defaultPlace: null,
    });
  });

  it("prefers the list's own active territory/place filters once set", async () => {
    await render(<DiariesScreen />);
    const { onFiltersChange } = mockListScreenCapture.mock.calls[0][0];
    await act(async () => {
      await onFiltersChange({ territory: 9, place: 3 });
    });
    // onFiltersChange updates state — re-render to pick up the new onAdd closure.
    const propsAfter = mockListScreenCapture.mock.calls.at(-1)[0];
    await propsAfter.onAdd();
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith("DiaryEditor", {
      defaultTerritory: 9,
      defaultPlace: 3,
    });
  });

  it("noItems' first action triggers the same handleAdd", async () => {
    await render(<DiariesScreen />);
    const { noItems, onAdd } = mockListScreenCapture.mock.calls[0][0];
    expect(noItems.actions[0].onPress).toBe(onAdd);
  });
});

describe("map mode", () => {
  const switchToMap = async () => {
    await render(<DiariesScreen />);
    await act(async () => {
      await render(lastProps().topEl);
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("diaries-view-map"));
    });
  };

  it("opens in the mode last used on this screen", async () => {
    (loadViewMode as jest.Mock).mockResolvedValue("map");

    await render(<DiariesScreen />);

    expect(lastProps().fetchFunction).toBe(fetchDiaryPlaces);
  });

  it("reads places instead of diaries, under its own query key", async () => {
    await switchToMap();

    const props = lastProps();
    expect(props.fetchFunction).toBe(fetchDiaryPlaces);
    expect(props.queryKeyExtra).toBe("map");
    expect(props.allowSort).toBe(false);
    // A locally-queued diary has no aggregated place row to draw, and a
    // species belongs to an observation rather than to the outing itself.
    expect(props.allowedFilters).not.toContain("unsynced");
    expect(props.allowedFilters).not.toContain("species");
  });

  it("remembers the switch", async () => {
    await switchToMap();
    expect(saveViewMode).toHaveBeenCalledWith("Diaries", "map");
  });

  it("sizes the map by outings, not observations", async () => {
    await switchToMap();

    const { getByText } = await render(
      lastProps().renderContent([{ id: 1 }, { id: 2 }], {
        onClear: jest.fn(),
      }),
    );
    expect(getByText("map-2-diary_place_count")).toBeOnTheScreen();
  });

  it("counts outings, not places, in the header badge", async () => {
    await switchToMap();

    const badge = lastProps().customHeaderBadge({
      results: [
        {
          id: 1,
          name: "a",
          location: { type: "Point", coordinates: [1, 2] },
          observation_count: 40,
          species_count: 1,
          diary_place_count: 3,
        },
        {
          id: 2,
          name: "b",
          location: { type: "Point", coordinates: [3, 4] },
          observation_count: 60,
          species_count: 2,
          diary_place_count: 4,
        },
      ],
    });

    expect(badge).toBe(7);
  });

  it("offers to reset filters when they are what emptied the map", async () => {
    await switchToMap();

    const { getByText } = await render(
      lastProps().renderContent([], { type: "filtered", onClear: jest.fn() }),
    );
    expect(getByText("nothing_found")).toBeOnTheScreen();
  });
});

describe("place sheet", () => {
  const tapPlace = async (diaryCount = 3) => {
    (loadViewMode as jest.Mock).mockResolvedValue("map");
    await render(<DiariesScreen />);

    const mapElement = lastProps().renderContent([{ id: 1 }], {
      onClear: jest.fn(),
    }) as unknown as {
      props: { onSelectPlace: (p: Record<string, unknown>) => void };
    };
    mapElement.props.onSelectPlace({
      id: 42,
      name: "Marsh",
      diary_place_count: diaryCount,
    });

    return (BottomSheet.showMenu as jest.Mock).mock.calls[0][0];
  };

  it("shows the place's outings by switching to the list, filtered to it", async () => {
    const { title, items } = await tapPlace();
    expect(title).toBe("Marsh");

    await act(async () => {
      items[0].onPress();
    });

    expect(mockNavigation.setParams).toHaveBeenCalledWith({
      filtersOverride: expect.objectContaining({ place: 42 }),
    });
    expect(saveViewMode).toHaveBeenLastCalledWith("Diaries", "list");
    expect(lastProps().fetchFunction).toBe(fetchDiaries);
  });

  it("opens the one outing a place holds instead of listing it", async () => {
    const diary = { id: 9, name: "Dawn walk" };
    (fetchOnlyDiaryAtPlace as jest.Mock).mockResolvedValue(diary);
    const { items } = await tapPlace(1);

    await act(async () => {
      await items[0].onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith("DiaryDetail", {
      diaryId: 9,
      initialDiary: diary,
    });
    expect(mockNavigation.setParams).not.toHaveBeenCalled();
  });

  it("falls back to the filtered list when that one outing cannot be found", async () => {
    (fetchOnlyDiaryAtPlace as jest.Mock).mockResolvedValue(null);
    const { items } = await tapPlace(1);

    await act(async () => {
      await items[0].onPress();
    });

    expect(mockNavigation.setParams).toHaveBeenCalledWith({
      filtersOverride: expect.objectContaining({ place: 42 }),
    });
  });

  it("opens the place itself", async () => {
    const { items } = await tapPlace();

    await act(async () => {
      items[1].onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceDetail", {
      placeId: 42,
    });
  });

  it("closes the sheet behind every action", async () => {
    // The menu sheet never dismisses itself — see UniversalBottomSheet.
    const { items } = await tapPlace();

    for (const item of items) {
      (BottomSheet.hide as jest.Mock).mockClear();
      await act(async () => {
        item.onPress();
      });
      expect(BottomSheet.hide).toHaveBeenCalled();
    }
  });
});
