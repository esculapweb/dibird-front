jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));
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
jest.mock("../../../store/location-context", () => ({ useLocation: jest.fn() }));
jest.mock("../../../store/alert-settings-context", () => ({ useAlertSettings: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import { useList } from "../../../hooks/useList";
import { fetchCommunityObservations } from "../../../util/fetches";
import { useLocation } from "../../../store/location-context";
import { useAlertSettings } from "../../../store/alert-settings-context";
import { formatDateShort, normalizeDistance } from "../../../util/helpers";
import RareNearby from "../RareNearby";
import { AlertSettings } from "../../../services/alertSettings";
import { Filters, ObservationItem } from "../../../types";

const mockNavigation = createNavigationMock();

const SETTINGS = { territory_data: { id: 5, name: "France" }, radius_km: 50 } as AlertSettings;

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
  (useLocation as jest.Mock).mockReturnValue({ locationCoords: [2, 48] });
  (useAlertSettings as jest.Mock).mockReturnValue({ settings: SETTINGS });
  mockList([observationItem()]);
});

it("derives useList's filters from the alert settings territory/radius, enabled only with settings", async () => {
  await render(<RareNearby filters={{}} />);
  const props = lastListCall();
  expect(props.screenName).toBe("RareNearby");
  expect(props.filters).toEqual({ territory: 5, radius: 50 });
  expect(props.sort).toBe("-date_time");
  expect(props.locationCoords).toEqual([2, 48]);
  expect(props.enabled).toBe(true);
});

it("disables the list when there are no alert settings yet", async () => {
  (useAlertSettings as jest.Mock).mockReturnValue({ settings: null });
  await render(<RareNearby filters={{}} />);
  expect(lastListCall().enabled).toBe(false);
});

it("fetchFunction forwards locationCoords and a radius of 3 to fetchCommunityObservations", async () => {
  await render(<RareNearby filters={{}} />);
  const fetchFunction = lastListCall().fetchFunction;

  await fetchFunction({ territory: 5 }, "-date_time", "robin", 2);
  expect(fetchCommunityObservations).toHaveBeenCalledWith(
    { territory: 5 },
    "-date_time",
    "robin",
    2,
    [2, 48],
    3,
  );
});

describe("loading state", () => {
  it("shows the section header but not the 'see all' link while loading", async () => {
    mockList(undefined, true);
    await render(<RareNearby filters={{}} />);
    expect(screen.getByText("rare_nearby")).toBeOnTheScreen();
    expect(screen.queryByText("all", { exact: false })).not.toBeOnTheScreen();
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

  it("'see all' navigates to Community with the settings' territory and place/species cleared", async () => {
    const filters: Filters = { place: 9, species: 3 };
    await render(<RareNearby filters={filters} />);
    await fireEvent.press(screen.getByText("all", { exact: false }));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Community", {
      filtersOverride: { place: null, species: null, territory: 5 },
    });
  });
});
