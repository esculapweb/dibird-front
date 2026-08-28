jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../util/fetches", () => ({
  fetchPlaces: jest.fn(),
  fetchPlacesForMap: jest.fn(),
  fetchOnlyObservationAtPlace: jest.fn(),
}));
jest.mock("../../store/location-context", () => ({
  useLocation: jest.fn(),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn(), showMenu: jest.fn(), hide: jest.fn() },
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
// The map drags in MapLibre and the native clipboard through MapL; this screen
// is only responsible for handing it the places.
jest.mock("../../components/Map/PlacesMap", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      places,
      includeEmpty,
    }: {
      places: { id: number }[];
      includeEmpty?: boolean;
    }) => <Text>{`map-${places.length}-${includeEmpty ? "all" : "nonempty"}`}</Text>,
  };
});
jest.mock("../../components/Place/PlaceCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, index }: { item: { id: number }; index: number }) => (
      <Text>{`place-card-${item.id}-${index}`}</Text>
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

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  fetchOnlyObservationAtPlace,
  fetchPlaces,
  fetchPlacesForMap,
} from "../../util/fetches";
import { useLocation } from "../../store/location-context";
import { loadViewMode, saveViewMode } from "../../util/storageHelper";
import { BottomSheet } from "../../services/bottomSheet";
import { createNavigationMock, createRouteMock } from "../test-utils";
import PlacesScreen from "../PlacesScreen";

const lastProps = () => mockListScreenCapture.mock.calls.at(-1)![0];

const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("Places", {});

beforeEach(() => {
  jest.clearAllMocks();
  (useLocation as jest.Mock).mockReturnValue({
    locationCoords: { lat: 1, lon: 2 },
    locationAvailable: true,
  });
  (loadViewMode as jest.Mock).mockResolvedValue(null);
});

it("passes fetchPlaces, restricted filters, search, and location props through to ListScreen", async () => {
  await render(<PlacesScreen />);

  const props = mockListScreenCapture.mock.calls[0][0];
  expect(props.fetchFunction).toBe(fetchPlaces);
  expect(props.title).toBe("places");
  expect(props.errorTitle).toBe("places_unavailable");
  expect(props.allowedFilters).toEqual([
    "territory",
    "date",
    "favourite",
    "radius",
    "unsynced",
  ]);
  expect(props.showSearch).toBe(true);
  expect(props.locationCoords).toEqual({ lat: 1, lon: 2 });
  expect(props.locationAvailable).toBe(true);
  expect(typeof props.onLocationUnavailable).toBe("function");
});

it("renders a PlaceCard for each item via renderItem", async () => {
  await render(<PlacesScreen />);
  const { renderItem } = mockListScreenCapture.mock.calls[0][0];
  const { getByText } = await render(renderItem({ item: { id: 4 }, index: 1 }));
  expect(getByText("place-card-4-1")).toBeOnTheScreen();
});

it("handleAdd navigates to PlaceEditor with no params, wired the same way for onAdd and noItems' action", async () => {
  await render(<PlacesScreen />);
  const { onAdd, noItems } = mockListScreenCapture.mock.calls[0][0];

  onAdd();

  expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceEditor");
  expect(noItems.actions[0].onPress).toBe(onAdd);
});

describe("map mode", () => {
  const switchToMap = async () => {
    await render(<PlacesScreen />);
    await act(async () => {
      await render(lastProps().topEl);
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("places-view-map"));
    });
  };

  it("opens in the mode last used on this screen", async () => {
    (loadViewMode as jest.Mock).mockResolvedValue("map");

    await render(<PlacesScreen />);

    expect(lastProps().fetchFunction).toBe(fetchPlacesForMap);
  });

  it("reads the map fetcher under its own query key", async () => {
    await switchToMap();

    const props = lastProps();
    expect(props.fetchFunction).toBe(fetchPlacesForMap);
    expect(props.queryKeyExtra).toBe("map");
    expect(props.allowSort).toBe(false);
    // Neither has a meaning against the places endpoint on a map.
    expect(props.allowedFilters).not.toContain("unsynced");
    expect(props.allowedFilters).not.toContain("radius");
  });

  it("remembers the switch", async () => {
    await switchToMap();
    expect(saveViewMode).toHaveBeenCalledWith("Places", "map");
  });

  it("keeps places that have no observations", async () => {
    // The Observations map drops them as noise; here an empty place is a real
    // place the user created and came to this screen to manage.
    await switchToMap();

    const { getByText } = await render(
      lastProps().renderContent([{ id: 1 }, { id: 2 }], {
        onClear: jest.fn(),
      }),
    );
    expect(getByText("map-2-all")).toBeOnTheScreen();
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
  const tapPlace = async (place: Record<string, unknown>) => {
    (loadViewMode as jest.Mock).mockResolvedValue("map");
    await render(<PlacesScreen />);

    const mapElement = lastProps().renderContent([{ id: 1 }], {
      onClear: jest.fn(),
    }) as unknown as {
      props: { onSelectPlace: (p: Record<string, unknown>) => void };
    };
    mapElement.props.onSelectPlace(place);

    return (BottomSheet.showMenu as jest.Mock).mock.calls[0][0];
  };

  it("leads with opening the place", async () => {
    const { title, items } = await tapPlace({
      id: 42,
      name: "Marsh",
      observation_count: 7,
    });

    expect(title).toBe("Marsh");
    items[0].onPress();
    expect(BottomSheet.hide).toHaveBeenCalled();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceDetail", {
      placeId: 42,
    });
  });

  it("offers the place's observations on the observations screen", async () => {
    const { items } = await tapPlace({
      id: 42,
      name: "Marsh",
      observation_count: 7,
    });

    items[1].onPress();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Observations", {
      filtersOverride: { place: 42 },
    });
  });

  it("opens the one observation a place holds instead of listing it", async () => {
    const observation = { id: 7, species_name: "Robin" };
    (fetchOnlyObservationAtPlace as jest.Mock).mockResolvedValue(observation);
    const { items } = await tapPlace({
      id: 42,
      name: "Marsh",
      observation_count: 1,
    });

    await act(async () => {
      await items[1].onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationDetail", {
      observationId: 7,
      initialObservation: observation,
    });
  });

  it("does not offer observations for a place that has none", async () => {
    // That link would land on an Observations list filtered to nothing.
    const { items } = await tapPlace({
      id: 42,
      name: "Marsh",
      observation_count: 0,
    });

    expect(items).toHaveLength(1);
  });
});
