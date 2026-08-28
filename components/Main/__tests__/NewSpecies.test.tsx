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
      <View testID="ns-image" accessibilityValue={{ text: source.uri }} />
    ),
  };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="ns-image-placeholder" /> };
});
jest.mock("../../../hooks/useList", () => ({ useList: jest.fn() }));
jest.mock("../../../util/fetches", () => ({ fetchStat: jest.fn() }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import { useList } from "../../../hooks/useList";
import { fetchStat } from "../../../util/fetches";
import { formatDateShort } from "../../../util/helpers";
import NewSpecies from "../NewSpecies";
import { Filters, SpeciesItem } from "../../../types";

const mockNavigation = createNavigationMock();
const mockOpenSpecies = jest.fn();

const speciesItem = (overrides: Partial<SpeciesItem> = {}): SpeciesItem => ({
  species_id: 1,
  sp_name: "Blue Tit",
  sp_latin: "Cyanistes caeruleus",
  sp_name_lang: "Blue Tit",
  sp_thumb: null,
  segment: "blue-tit",
  seen: true,
  min_date: "2026-01-15",
  max_date: "2026-01-15",
  qty_observations: 1,
  qty_countries: 1,
  min_created_at: "2026-01-15",
  min_territory: null,
  max_territory: null,
  ...overrides,
});

const mockList = (data: SpeciesItem[] | undefined, isLoading = false) => {
  (useList as jest.Mock).mockReturnValue({
    data: data ? { pages: [{ results: data }] } : undefined,
    isLoading,
  });
};

const lastListCall = () => (useList as jest.Mock).mock.calls.at(-1)![0];

beforeEach(() => {
  jest.clearAllMocks();
  mockList([speciesItem()]);
});

it("passes filters/sort/tabsMode/enabled through to useList", async () => {
  await render(<NewSpecies filters={{ territory: 5 }} filtersLoaded />);
  const props = lastListCall();
  expect(props.screenName).toBe("Stat");
  expect(props.filters).toEqual({ territory: 5 });
  expect(props.sort).toBe("-seen,-date_time");
  expect(props.tabsMode).toBe("seen");
  expect(props.enabled).toBe(true);
});

it("disables the list until filters have loaded", async () => {
  await render(<NewSpecies filters={{}} filtersLoaded={false} />);
  expect(lastListCall().enabled).toBe(false);
});

describe("fetchFunction (fetchStatSeen)", () => {
  it("strips place/species, forces seen:true, and defaults sort/search", async () => {
    await render(<NewSpecies filters={{}} filtersLoaded />);
    const fetchFunction = lastListCall().fetchFunction;

    await fetchFunction({ territory: 5, place: 9, species: 3 }, null, null, 1);
    expect(fetchStat).toHaveBeenCalledWith({ territory: 5, seen: true }, undefined, "", 1);
  });

  it("forwards a given sort/search as-is", async () => {
    await render(<NewSpecies filters={{}} filtersLoaded />);
    const fetchFunction = lastListCall().fetchFunction;

    await fetchFunction({ territory: 5 }, "-date_time", "robin", 2);
    expect(fetchStat).toHaveBeenCalledWith({ territory: 5, seen: true }, "-date_time", "robin", 2);
  });
});

describe("loading state", () => {
  it("shows the section header but not the 'see all' link while loading", async () => {
    mockList(undefined, true);
    await render(<NewSpecies filters={{}} filtersLoaded />);
    expect(screen.getByText("new_species")).toBeOnTheScreen();
    expect(screen.queryByText("all", { exact: false })).not.toBeOnTheScreen();
  });
});

it("renders nothing once loaded with no results", async () => {
  mockList([]);
  await render(<NewSpecies filters={{}} filtersLoaded />);
  expect(screen.queryByText("new_species")).not.toBeOnTheScreen();
});

it("shows at most 3 items even if more are returned", async () => {
  mockList([
    speciesItem({ species_id: 1, sp_name_lang: "A" }),
    speciesItem({ species_id: 2, sp_name_lang: "B" }),
    speciesItem({ species_id: 3, sp_name_lang: "C" }),
    speciesItem({ species_id: 4, sp_name_lang: "D" }),
  ]);
  await render(<NewSpecies filters={{}} filtersLoaded />);
  expect(screen.getByText("A")).toBeOnTheScreen();
  expect(screen.getByText("C")).toBeOnTheScreen();
  expect(screen.queryByText("D")).not.toBeOnTheScreen();
});

it("skips an item with no min_date (formatDateShort returns null)", async () => {
  mockList([speciesItem({ min_date: null })]);
  await render(<NewSpecies filters={{}} filtersLoaded />);
  expect(screen.queryByText("Blue Tit")).not.toBeOnTheScreen();
});

describe("thumbnail", () => {
  it("shows the image when sp_thumb is set", async () => {
    mockList([speciesItem({ sp_thumb: "species/1/t.jpg" })]);
    await render(<NewSpecies filters={{}} filtersLoaded />);
    expect(screen.getByTestId("ns-image").props.accessibilityValue.text).toBe(
      "https://test.local/media/species/1/t.jpg",
    );
  });

  it("falls back to a placeholder without a thumb", async () => {
    await render(<NewSpecies filters={{}} filtersLoaded />);
    expect(screen.getByTestId("ns-image-placeholder")).toBeOnTheScreen();
  });
});

describe("date formatting", () => {
  it("shows the year suffix when the active filter isn't a year filter", async () => {
    await render(<NewSpecies filters={{}} filtersLoaded />);
    const { y } = formatDateShort("2026-01-15")!;
    expect(screen.getByText(y, { exact: false })).toBeOnTheScreen();
  });

  it("hides the year suffix when filtering by year/this_year", async () => {
    await render(<NewSpecies filters={{ date: { type: "year", year: 2026 } }} filtersLoaded />);
    const { y } = formatDateShort("2026-01-15")!;
    expect(screen.queryByText(y, { exact: false })).not.toBeOnTheScreen();
  });
});

describe("navigation", () => {
  it("tapping an item navigates to Observations with a species filter override", async () => {
    await render(<NewSpecies filters={{ territory: 5, date: { type: "today" } }} filtersLoaded />);
    await fireEvent.press(screen.getByText("Blue Tit"));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Observations", {
      filtersOverride: {
        territory: 5,
        place: null,
        species: 1,
        speciesName: "Blue Tit",
        date: { type: "today" },
      },
    });
  });

  it("'see all' navigates to Stat with place/species cleared and seenMode 'seen'", async () => {
    const filters: Filters = { territory: 5, place: 9, species: 3 };
    await render(<NewSpecies filters={filters} filtersLoaded />);
    await fireEvent.press(screen.getByText("all", { exact: false }));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("Stat", {
      filtersOverride: { territory: 5, place: null, species: null },
      seenMode: "seen",
      o: "-seen,-date_time",
    });
  });
});

it("opens the species page from the thumbnail, the row still opening the observations", async () => {
  mockList([speciesItem()]);
  await render(<NewSpecies filters={{ territory: 5 }} filtersLoaded />);

  await fireEvent.press(screen.getByTestId("new-species-thumb-1"));

  expect(mockOpenSpecies).toHaveBeenCalledWith("blue-tit", "new_species");
  expect(mockNavigation.navigate).not.toHaveBeenCalled();
});
