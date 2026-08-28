jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useFocusEffect: (cb: () => void) =>
    require("react").useEffect(() => {
      cb();
    }, [cb]),
}));
jest.mock("../../util/fetches", () => ({
  fetchObservations: jest.fn(),
  fetchObservationPlaces: jest.fn(),
  fetchOnlyObservationAtPlace: jest.fn(),
}));
jest.mock("../../services/sync/observationSync", () => ({
  runObservationSync: jest.fn(),
}));
jest.mock("../../store/filters-context", () => ({
  useFilters: jest.fn(),
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});
jest.mock("../../util/storageHelper", () => ({
  loadViewMode: jest.fn(async () => null),
  saveViewMode: jest.fn(async () => {}),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { showMenu: jest.fn(), hide: jest.fn() },
}));
jest.mock("../../components/Observation/ObservationCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, index }: { item: { id: number }; index: number }) => (
      <Text>{`observation-card-${item.id}-${index}`}</Text>
    ),
  };
});
// The map drags in MapLibre and the native clipboard through MapL; this screen
// is only responsible for handing it the places.
jest.mock("../../components/Map/PlacesMap", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ places }: { places: { id: number }[] }) => (
      <Text>{`map-${places.length}`}</Text>
    ),
  };
});
jest.mock("../../components/Observation/NoPlaceObservationsNote", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: () => <Text>no-place-note</Text>,
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

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  fetchObservationPlaces,
  fetchObservations,
  fetchOnlyObservationAtPlace,
} from "../../util/fetches";
import { runObservationSync } from "../../services/sync/observationSync";
import { useFilters } from "../../store/filters-context";
import { loadViewMode, saveViewMode } from "../../util/storageHelper";
import { BottomSheet } from "../../services/bottomSheet";
import { createNavigationMock, createRouteMock } from "../test-utils";
import ObservationsScreen from "../ObservationsScreen";

const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("Observations", {});

// Untyped on purpose, like the direct mock.calls[0][0] reads below: this is
// whatever the screen handed ListScreen.
const lastProps = () => mockListScreenCapture.mock.calls.at(-1)![0];

beforeEach(() => {
  jest.clearAllMocks();
  (useFilters as jest.Mock).mockReturnValue({ territory: 5 });
  (loadViewMode as jest.Mock).mockResolvedValue(null);
});

it("passes fetchObservations and titles/errors through to ListScreen", async () => {
  await render(<ObservationsScreen />);

  const props = mockListScreenCapture.mock.calls[0][0];
  expect(props.fetchFunction).toBe(fetchObservations);
  expect(props.allowedFilters).toContain("private");
  expect(props.title).toBe("observations");
  expect(props.errorTitle).toBe("observations_unavailable");
});

it("retries the observation sync queue on focus", async () => {
  await render(<ObservationsScreen />);
  expect(runObservationSync).toHaveBeenCalledTimes(1);
});

it("renders an ObservationCard for each item via renderItem", async () => {
  await render(<ObservationsScreen />);
  const { renderItem } = mockListScreenCapture.mock.calls[0][0];
  const { getByText } = await render(renderItem({ item: { id: 7 }, index: 2 }));
  expect(getByText("observation-card-7-2")).toBeOnTheScreen();
});

describe("handleAdd defaults", () => {
  it("falls back to the global territory filter when no list filter is active yet", async () => {
    await render(<ObservationsScreen />);
    const { onAdd } = mockListScreenCapture.mock.calls[0][0];
    await onAdd();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
      defaultTerritory: 5,
      defaultPlace: null,
      defaultSpecies: null,
    });
  });

  it("prefers the list's own active territory/place/species filters once set", async () => {
    await render(<ObservationsScreen />);
    const { onFiltersChange } = mockListScreenCapture.mock.calls[0][0];
    await act(async () => {
      await onFiltersChange({ territory: 9, place: 3, species: 11 });
    });
    const propsAfter = mockListScreenCapture.mock.calls.at(-1)[0];
    await propsAfter.onAdd();
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith("ObservationEditor", {
      defaultTerritory: 9,
      defaultPlace: 3,
      defaultSpecies: 11,
    });
  });

  it("noItems' first action triggers the same handleAdd", async () => {
    await render(<ObservationsScreen />);
    const { noItems, onAdd } = mockListScreenCapture.mock.calls[0][0];
    expect(noItems.actions[0].onPress).toBe(onAdd);
  });
});

describe("map mode", () => {
  const switchToMap = async () => {
    await render(<ObservationsScreen />);
    await act(async () => {
      await render(lastProps().topEl);
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("observations-view-map"));
    });
  };

  it("opens in the mode last used on this screen", async () => {
    (loadViewMode as jest.Mock).mockResolvedValue("map");

    await render(<ObservationsScreen />);

    expect(lastProps().fetchFunction).toBe(fetchObservationPlaces);
  });

  it("reads places instead of observations, under its own query key", async () => {
    await switchToMap();

    const props = lastProps();
    expect(props.fetchFunction).toBe(fetchObservationPlaces);
    // Both modes are the "Observations" screen; without a distinct key their
    // react-query entries would collide.
    expect(props.queryKeyExtra).toBe("map");
    expect(props.allowSort).toBe(false);
    // A locally-queued observation has no aggregated place row to draw.
    expect(props.allowedFilters).not.toContain("unsynced");
  });

  it("remembers the switch", async () => {
    await switchToMap();
    expect(saveViewMode).toHaveBeenCalledWith("Observations", "map");
  });

  it("draws the places it was handed", async () => {
    await switchToMap();

    const { getByText } = await render(
      lastProps().renderContent([{ id: 1 }, { id: 2 }]),
    );
    expect(getByText("map-2")).toBeOnTheScreen();
  });

  it("offers to reset filters when they are what emptied the map", async () => {
    await switchToMap();
    const onClear = jest.fn();

    const { getByText } = await render(
      lastProps().renderContent([], { type: "filtered", onClear }),
    );

    expect(getByText("nothing_found")).toBeOnTheScreen();
  });

  it("invites a first observation when nothing is filtered out", async () => {
    await switchToMap();

    const { getByText } = await render(
      lastProps().renderContent([], { type: "initial", onClear: jest.fn() }),
    );

    expect(getByText("no_observations_yet")).toBeOnTheScreen();
  });

  it("counts observations, not places, in the header badge", async () => {
    await switchToMap();

    const badge = lastProps().customHeaderBadge({
      results: [
        {
          id: 1,
          name: "a",
          location: { type: "Point", coordinates: [1, 2] },
          observation_count: 4,
          species_count: 1,
        },
        {
          id: 2,
          name: "b",
          location: { type: "Point", coordinates: [3, 4] },
          observation_count: 6,
          species_count: 2,
        },
      ],
    });

    expect(badge).toBe(10);
  });

});

describe("place sheet", () => {
  const tapPlace = async (observationCount = 7) => {
    (loadViewMode as jest.Mock).mockResolvedValue("map");
    await render(<ObservationsScreen />);

    // renderContent builds the map element; the callback it hands the map is
    // what a tap on a dot ends up calling.
    const mapElement = lastProps().renderContent([
      { id: 1, observation_count: 1 },
    ]) as unknown as {
      props: { onSelectPlace: (place: Record<string, unknown>) => void };
    };

    mapElement.props.onSelectPlace({
      id: 42,
      name: "Marsh",
      observation_count: observationCount,
      species_count: 3,
    });

    return (BottomSheet.showMenu as jest.Mock).mock.calls[0][0];
  };

  it("names the tapped place", async () => {
    const { title } = await tapPlace();
    expect(title).toBe("Marsh");
  });

  it("shows the place's observations by switching to the list, filtered to it", async () => {
    // Regression: this used to navigate() to the screen it was already on,
    // which only rewrites params — the map stayed up and nothing happened.
    const { items } = await tapPlace();

    await act(async () => {
      items[0].onPress();
    });

    expect(mockNavigation.setParams).toHaveBeenCalledWith({
      filtersOverride: expect.objectContaining({ place: 42 }),
    });
    expect(saveViewMode).toHaveBeenLastCalledWith("Observations", "list");
    expect(lastProps().fetchFunction).toBe(fetchObservations);
  });

  it("opens the one observation a place holds instead of listing it", async () => {
    // A filtered list of a single row is a stop with nothing to choose on it.
    const observation = { id: 7, species_name: "Robin" };
    (fetchOnlyObservationAtPlace as jest.Mock).mockResolvedValue(observation);
    const { items } = await tapPlace(1);

    await act(async () => {
      await items[0].onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationDetail", {
      observationId: 7,
      initialObservation: observation,
    });
    expect(mockNavigation.setParams).not.toHaveBeenCalled();
  });

  it("falls back to the filtered list when that one observation cannot be found", async () => {
    // The count can drift from the data, and offline the row may never have
    // been cached. Landing on the list is where the tap used to go anyway.
    (fetchOnlyObservationAtPlace as jest.Mock).mockResolvedValue(null);
    const { items } = await tapPlace(1);

    await act(async () => {
      await items[0].onPress();
    });

    expect(mockNavigation.navigate).not.toHaveBeenCalledWith(
      "ObservationDetail",
      expect.anything(),
    );
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
