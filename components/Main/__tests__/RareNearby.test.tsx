jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));
jest.mock("../../../hooks/useOpenSpecies", () => ({
  useOpenSpecies: () => mockOpenSpecies,
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: ({ source }: { source: { uri: string } }) => (
      <View testID="rn-image" accessibilityValue={{ text: source.uri }} />
    ),
  };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="rn-image-placeholder" /> };
});
jest.mock("../../../hooks/useList", () => ({ useList: jest.fn() }));
jest.mock("../../../util/fetches", () => ({ fetchCommunityObservations: jest.fn() }));
jest.mock("../../../store/alert-settings-context", () => ({ useAlertSettings: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import { useList } from "../../../hooks/useList";
import { fetchCommunityObservations } from "../../../util/fetches";
import { useAlertSettings } from "../../../store/alert-settings-context";
import { formatDateShort, normalizeDistance } from "../../../util/helpers";
import RareNearby from "../RareNearby";
import { AlertSettings } from "../../../services/alertSettings";
import { Filters, ObservationItem } from "../../../types";

const mockNavigation = createNavigationMock();
const mockOpenSpecies = jest.fn();

const SETTINGS = {
  territory_data: { id: 5, name: "France" },
  radius_km: 50,
  location_lat: 48.85,
  location_lon: 2.35,
} as AlertSettings;

const observationItem = (overrides: Partial<ObservationItem> = {}): ObservationItem =>
  ({
    id: 1,
    date_time: "2026-01-15T10:00:00Z",
    species_data: { id: 1, name: "Cyanistes caeruleus", name_lang: "Blue Tit", segment: "blue-tit", thumb: null },
    distance: 2500,
    ...overrides,
  }) as ObservationItem;

const mockList = (data: ObservationItem[] | undefined, isLoading = false) => {
  (useList as jest.Mock).mockReturnValue({
    data: data ? { pages: [{ results: data }] } : undefined,
    isLoading,
  });
};

const lastListCall = () => (useList as jest.Mock).mock.calls.at(-1)![0];

beforeEach(() => {
  jest.clearAllMocks();
  (useAlertSettings as jest.Mock).mockReturnValue({ settings: SETTINGS });
  mockList([observationItem()]);
});

// The server applies the territory and the radius from the alert settings: our
// own GPS fix gave a different centre than the pushes did, and without the
// permission there were no coordinates at all — so the backend silently skipped
// the radius. `rare` is asked for explicitly too: the same feed also carries
// ordinary public observations of dibird users, and a widget titled "rare
// nearby" must not quietly start listing sparrows.
it("asks the server for the alert-settings scope, enabled only with settings", async () => {
  await render(<RareNearby filters={{}} />);
  const props = lastListCall();
  expect(props.screenName).toBe("RareNearby");
  expect(props.filters).toEqual({ near: "alerts", rare: true });
  expect(props.sort).toBe("-date_time");
  expect(props.locationCoords).toBeUndefined();
  expect(props.enabled).toBe(true);
});

// The scope is no longer visible in the filters, and it changes on the client —
// without it in the key the list would stay assembled from the previous radius.
it("keys the query by the scope the settings describe", async () => {
  await render(<RareNearby filters={{}} />);
  expect(lastListCall().queryKeyExtra).toBe("5:50:48.85:2.35");
});

it("disables the list when there are no alert settings yet", async () => {
  (useAlertSettings as jest.Mock).mockReturnValue({ settings: null });
  await render(<RareNearby filters={{}} />);
  const props = lastListCall();
  expect(props.enabled).toBe(false);
  expect(props.queryKeyExtra).toBeNull();
});

it("fetchFunction sends no coordinates and a radius of 3 to fetchCommunityObservations", async () => {
  await render(<RareNearby filters={{}} />);
  const fetchFunction = lastListCall().fetchFunction;

  await fetchFunction({ near: "alerts" }, "-date_time", "robin", 2);
  expect(fetchCommunityObservations).toHaveBeenCalledWith(
    { near: "alerts" },
    "-date_time",
    "robin",
    2,
    null,
    3,
  );
});

describe("scope label", () => {
  it("names the country and the radius once a centre is stored", async () => {
    await render(<RareNearby filters={{}} />);
    expect(
      screen.getByText(`France, ${normalizeDistance(50000)}`),
    ).toBeOnTheScreen();
  });

  // A radius with no stored point has nothing to apply to — calling such a list
  // "within 50 km" is a lie: the server returned the whole country.
  it("drops the radius when there is no stored centre", async () => {
    (useAlertSettings as jest.Mock).mockReturnValue({
      settings: { ...SETTINGS, location_lat: null, location_lon: null },
    });
    await render(<RareNearby filters={{}} />);

    expect(screen.getByText("France")).toBeOnTheScreen();
    expect(
      screen.queryByText(`France, ${normalizeDistance(50000)}`),
    ).not.toBeOnTheScreen();
  });

  // The scope reads as a caption unless the action is spelled out, and the trip
  // to the alert settings — the only place where the country and the radius are
  // set — is the whole point of the line.
  it("offers to change the scope next to it", async () => {
    await render(<RareNearby filters={{}} />);
    expect(
      screen.getByText("rare_nearby_change", { exact: false }),
    ).toBeOnTheScreen();
  });

  it("asks for a location when neither a centre nor a country is known", async () => {
    (useAlertSettings as jest.Mock).mockReturnValue({
      settings: {
        ...SETTINGS,
        location_lat: null,
        location_lon: null,
        territory_data: null,
      },
    });
    await render(<RareNearby filters={{}} />);

    expect(screen.getByText("rare_nearby_set_location")).toBeOnTheScreen();
    // The invitation is already an action — a second "change" next to it is noise.
    expect(
      screen.queryByText("rare_nearby_change", { exact: false }),
    ).not.toBeOnTheScreen();
  });
});

describe("loading state", () => {
  it("shows the section header but not the 'see all' link while loading", async () => {
    mockList(undefined, true);
    await render(<RareNearby filters={{}} />);
    expect(screen.getByText("rare_nearby")).toBeOnTheScreen();
    expect(screen.queryByText("all", { exact: false })).not.toBeOnTheScreen();
  });

  // The header keeps the scope row's height while loading, or the title jumps
  // once the list arrives.
  it("holds the scope row's place", async () => {
    mockList(undefined, true);
    await render(<RareNearby filters={{}} />);
    expect(screen.getByTestId("rare-nearby-scope-skeleton")).toBeOnTheScreen();
  });
});

it("renders nothing once loaded with no results", async () => {
  mockList([]);
  await render(<RareNearby filters={{}} />);
  expect(screen.queryByText("rare_nearby")).not.toBeOnTheScreen();
});

it("shows at most 3 items even if more are returned", async () => {
  mockList([
    observationItem({ id: 1, species_data: { id: 1, name: "a", name_lang: "A", segment: "a", thumb: null } }),
    observationItem({ id: 2, species_data: { id: 2, name: "b", name_lang: "B", segment: "b", thumb: null } }),
    observationItem({ id: 3, species_data: { id: 3, name: "c", name_lang: "C", segment: "c", thumb: null } }),
    observationItem({ id: 4, species_data: { id: 4, name: "d", name_lang: "D", segment: "d", thumb: null } }),
  ]);
  await render(<RareNearby filters={{}} />);
  expect(screen.getByText("A")).toBeOnTheScreen();
  expect(screen.getByText("C")).toBeOnTheScreen();
  expect(screen.queryByText("D")).not.toBeOnTheScreen();
});

it("skips an item with no date_time (formatDateShort returns null)", async () => {
  mockList([observationItem({ date_time: null as unknown as string })]);
  await render(<RareNearby filters={{}} />);
  expect(screen.queryByText("Blue Tit")).not.toBeOnTheScreen();
});

describe("thumbnail", () => {
  it("shows the image when species_data.thumb is set", async () => {
    mockList([observationItem({ species_data: { id: 1, name: "x", name_lang: "x", segment: "x", thumb: "species/1/t.jpg" } })]);
    await render(<RareNearby filters={{}} />);
    expect(screen.getByTestId("rn-image").props.accessibilityValue.text).toBe(
      "https://test.local/media/species/1/t.jpg",
    );
  });

  it("falls back to a placeholder without a thumb", async () => {
    await render(<RareNearby filters={{}} />);
    expect(screen.getByTestId("rn-image-placeholder")).toBeOnTheScreen();
  });
});

describe("distance/date column", () => {
  it("shows the date and normalized distance when distance is set", async () => {
    await render(<RareNearby filters={{}} />);
    const { d } = formatDateShort("2026-01-15T10:00:00Z")!;
    expect(screen.getByText(d)).toBeOnTheScreen();
    expect(screen.getByText(normalizeDistance(2500))).toBeOnTheScreen();
  });

  it("hides the whole date/distance column when distance is falsy", async () => {
    mockList([observationItem({ distance: null })]);
    await render(<RareNearby filters={{}} />);
    const { d } = formatDateShort("2026-01-15T10:00:00Z")!;
    expect(screen.queryByText(d)).not.toBeOnTheScreen();
  });
});

describe("navigation", () => {
  it("tapping an item navigates to CommunityDetail", async () => {
    await render(<RareNearby filters={{}} />);
    await fireEvent.press(screen.getByText("Blue Tit"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("CommunityDetail", { observationId: 1 });
  });

  it("tapping the scope opens the alert settings", async () => {
    await render(<RareNearby filters={{}} />);
    await fireEvent.press(screen.getByTestId("rare-nearby-scope"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("AlertSettings");
  });

  it("'see all' navigates to Community with the settings' territory and place/species cleared", async () => {
    const filters: Filters = { place: 9, species: 3 };
    await render(<RareNearby filters={filters} />);
    await fireEvent.press(screen.getByText("all", { exact: false }));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Community", {
      filtersOverride: { place: null, species: null, territory: 5 },
    });
  });
});

// The rare-bird row is where "what is that?" gets asked, and until now it only
// led to the sighting.
it("opens the species page from the thumbnail, the row still opening the sighting", async () => {
  mockList([observationItem()]);
  await render(<RareNearby filters={{}} />);

  await fireEvent.press(screen.getByTestId("rare-nearby-species-thumb-1"));

  expect(mockOpenSpecies).toHaveBeenCalledWith("blue-tit", "rare_nearby");
  expect(mockNavigation.navigate).not.toHaveBeenCalled();
});
