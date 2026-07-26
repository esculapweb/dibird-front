jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({
      top,
      children,
      bottom,
    }: {
      top?: import("react").ReactNode;
      children: import("react").ReactNode;
      bottom?: import("react").ReactNode;
    }) => (
      <View>
        {top}
        {children}
        {bottom}
      </View>
    ),
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("../../util/fetches", () => ({
  fetchTaxonDetail: jest.fn(),
  fetchTaxonSegmentById: jest.fn(),
}));
jest.mock("../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));
jest.mock("../../hooks/useContentWidth", () => ({ useContentWidth: () => 400 }));
jest.mock("../../hooks/useDefaultTerritory", () => ({
  useDefaultTerritory: jest.fn(),
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("expo-audio", () => ({
  useAudioPlayer: () => ({ play: jest.fn(), pause: jest.fn(), seekTo: jest.fn() }),
  useAudioPlayerStatus: () => ({ playing: false, didJustFinish: false }),
}));
jest.mock("react-native-render-html", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ source }: { source: { html: string } }) => <Text>{source.html}</Text>,
  };
});

import { Share } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { createNavigationMock, createRouteMock } from "../test-utils";
import { useDefaultTerritory } from "../../hooks/useDefaultTerritory";
import SpeciesDetailScreen from "../SpeciesDetailScreen";
import { TaxonSpeciesDetail } from "../../types";

let mockRoute: ReturnType<typeof createRouteMock>;
const mockNavigation = createNavigationMock();
const mockUseQuery = useQuery as jest.Mock;

const baseDetail: TaxonSpeciesDetail = {
  taxon_id: 1,
  name: "Blue Tit / Cyanistes caeruleus",
  name_lang: "Blue Tit",
  latin_name: "Cyanistes caeruleus",
  segment: "blue-tit",
  extinct: false,
  metadata: {
    title: "",
    meta_description: "",
    h1: "",
    short: "<p>A small bird.</p>",
    image: null,
  },
  alternates: [],
  count: null,
  paging: { prev: null, next: null },
  status: { status_id: "LC", name: "Least Concern", s_id: 9 },
  authority: "Linnaeus, 1758",
  breeding_regions: ["Europe"],
  breeding_subregion: null,
  nonbreeding_region: null,
  parents: [
    { depth: 2, parent_name: "Passeriformes", parent_name_lang: "Passeriformes", parent_segment: "passeriformes" },
  ],
  subspecies: [],
  photos: [],
  sounds: [],
  related: { count: 0, species: [] },
  countries: [{ code: "GB", name: "United Kingdom", segment: "united-kingdom", status: "resident", region: "Northern Europe" }],
  multilangs: { langs: {}, synonyms: [], protonyms: [] },
};

const segmentResult = (overrides: Record<string, unknown> = {}) => ({
  data: undefined,
  isError: false,
  error: null,
  refetch: jest.fn(),
  ...overrides,
});

const detailResult = (overrides: Record<string, unknown> = {}) => ({
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  ...overrides,
});

const mockQueries = ({
  segment = segmentResult(),
  detail = detailResult(),
}: { segment?: ReturnType<typeof segmentResult>; detail?: ReturnType<typeof detailResult> } = {}) => {
  mockUseQuery.mockImplementation((opts: { queryKey: unknown[] }) => {
    if (opts.queryKey[0] === "TaxonSegmentById") return segment;
    if (opts.queryKey[0] === "TaxonSpeciesDetail") return detail;
    throw new Error(`unexpected queryKey ${String(opts.queryKey[0])}`);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = createRouteMock("SpeciesDetail", { segment: "blue-tit" });
  (useDefaultTerritory as jest.Mock).mockReturnValue(4);
  mockQueries();
});

it("fetches the species detail by the segment already in route params", async () => {
  await render(<SpeciesDetailScreen />);
  const detailCall = mockUseQuery.mock.calls.find(
    (c) => c[0].queryKey[0] === "TaxonSpeciesDetail",
  )[0];
  expect(detailCall.queryKey).toEqual(["TaxonSpeciesDetail", "blue-tit", "en"]);
  expect(detailCall.enabled).toBe(true);
});

it("resolves the segment from a numeric id first when the route only has an id (e.g. a push notification)", async () => {
  mockRoute = createRouteMock("SpeciesDetail", { id: 42 });
  mockQueries({ segment: segmentResult({ data: "blue-tit" }) });

  await render(<SpeciesDetailScreen />);

  const segmentCall = mockUseQuery.mock.calls.find(
    (c) => c[0].queryKey[0] === "TaxonSegmentById",
  )[0];
  expect(segmentCall.queryKey).toEqual(["TaxonSegmentById", 42]);
  expect(segmentCall.enabled).toBe(true);

  const detailCall = mockUseQuery.mock.calls.find(
    (c) => c[0].queryKey[0] === "TaxonSpeciesDetail",
  )[0];
  expect(detailCall.queryKey).toEqual(["TaxonSpeciesDetail", "blue-tit", "en"]);
});

it("can pull to refetch, since species data is cached for a day", async () => {
  const refetch = jest.fn();
  mockQueries({ detail: detailResult({ data: baseDetail, refetch }) });

  await render(<SpeciesDetailScreen />);
  const scroll = screen.getByTestId("species-scroll");
  await scroll.props.refreshControl.props.onRefresh();

  expect(refetch).toHaveBeenCalledTimes(1);
});

it("shows the loading overlay while there is no data yet", async () => {
  await render(<SpeciesDetailScreen />);
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});

it("shows an error overlay with retry when the id→segment lookup fails", async () => {
  const refetch = jest.fn();
  mockRoute = createRouteMock("SpeciesDetail", { id: 42 });
  mockQueries({ segment: segmentResult({ isError: true, error: { message: "boom" }, refetch }) });

  await render(<SpeciesDetailScreen />);
  expect(screen.getByText("species_unavailable")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("try_again"));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it("shows an error overlay with retry when the species detail fetch fails", async () => {
  const refetch = jest.fn();
  mockQueries({ detail: detailResult({ isError: true, error: { message: "boom" }, refetch }) });

  await render(<SpeciesDetailScreen />);
  expect(screen.getByText("species_unavailable")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("try_again"));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it("redirects to the canonical segment via setParams when the API returns a redirect", async () => {
  // The redirect response is partial — just { redirect, name_lang: null }, with
  // no multilangs/countries/parents — so this must not spread baseDetail, or it
  // wouldn't catch the crash on data?.multilangs?.langs during the render that
  // happens before the redirect effect refetches.
  mockQueries({
    detail: detailResult({ data: { redirect: "eurasian-blue-tit", name_lang: null } }),
  });

  await render(<SpeciesDetailScreen />);
  expect(mockNavigation.setParams).toHaveBeenCalledWith({ segment: "eurasian-blue-tit" });
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});

it("renders the species name, status, description, breeding range, countries and subspecies", async () => {
  mockQueries({
    detail: detailResult({
      data: {
        ...baseDetail,
        subspecies: [{ name: "C. c. ogliastrae", extinct: false, authority: "Hartert, 1901", breeding_subregion: null, nonbreeding_region: null }],
      },
    }),
  });

  await render(<SpeciesDetailScreen />);

  expect(screen.getByText("Blue Tit")).toBeOnTheScreen();
  expect(screen.getByText("Cyanistes caeruleus, Linnaeus, 1758")).toBeOnTheScreen();
  expect(screen.getByText("Least Concern")).toBeOnTheScreen();
  expect(screen.getByText("<p>A small bird.</p>")).toBeOnTheScreen();
  expect(screen.getByText("Europe")).toBeOnTheScreen();
  expect(screen.getByText("C. c. ogliastrae, Hartert, 1901")).toBeOnTheScreen();
  expect(screen.getByText("Passeriformes")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("countries"));
  expect(screen.getByText("🇬🇧 United Kingdom")).toBeOnTheScreen();
});

const withTraits = {
  ...baseDetail,
  trait_highlights: [
    { key: "MASS", label: "Body mass", value: "3.42 kg" },
    { key: "CLUTCH", label: "Clutch size", value: "4 eggs" },
  ],
  traits: [
    {
      key: "BODY",
      label: "Measurements",
      traits: [
        {
          key: "MASS",
          label: "Body mass",
          value: "3.42 kg",
          num: 3422,
          sample_size: 2,
          spread: "3.4–3.45 kg",
          sources_label: "2 sources",
          male: "3.54 kg",
          female: "3.33 kg",
          source: "Myhrvold et al. 2015; Tobias et al. 2021",
          source_url: "https://figshare.com/x",
        },
      ],
    },
    {
      key: "SURVIVAL",
      label: "Lifespan",
      traits: [
        {
          key: "MAX_AGE",
          label: "Maximum recorded age",
          value: "48 years",
          num: 48,
          sample_size: 1,
          spread: "",
          sources_label: "",
          male: null,
          female: null,
          source: "Myhrvold et al. 2015",
          source_url: null,
        },
      ],
    },
  ],
};

it("has no biology tab for a species Avibase has no measurements for", async () => {
  mockQueries({ detail: detailResult({ data: baseDetail }) });

  await render(<SpeciesDetailScreen />);

  expect(screen.queryByText("biology")).toBeNull();
});

it("shows the curated traits grouped into cards, with the per-sex figures and the source", async () => {
  mockQueries({ detail: detailResult({ data: withTraits }) });

  await render(<SpeciesDetailScreen />);
  await fireEvent.press(screen.getByText("biology"));

  expect(screen.getByText("Measurements")).toBeOnTheScreen();
  expect(screen.getByText("Lifespan")).toBeOnTheScreen();
  expect(screen.getByText("48 years")).toBeOnTheScreen();
  expect(screen.getByText("♂ 3.54 kg  ♀ 3.33 kg")).toBeOnTheScreen();
  expect(
    screen.getByText("Myhrvold et al. 2015; Tobias et al. 2021"),
  ).toBeOnTheScreen();
});

it("prints a published range as the value, without a spread under it", async () => {
  // Counts of whole things (clutch, incubation) come from sources as
  // "3-7 eggs"; measurements come as one figure plus disagreement.
  mockQueries({
    detail: detailResult({
      data: {
        ...withTraits,
        traits: [
          {
            key: "REPROD",
            label: "Breeding",
            traits: [
              {
                key: "CLUTCH",
                label: "Clutch size",
                value: "3–7 eggs",
                num: 4.5,
                sample_size: 3,
                spread: "",
                sources_label: "3 sources",
                male: null,
                female: null,
                source: "Myhrvold et al. 2015; birdzilla",
                source_url: null,
              },
            ],
          },
        ],
      },
    }),
  });

  await render(<SpeciesDetailScreen />);
  await fireEvent.press(screen.getByText("biology"));

  expect(screen.getByText("3–7 eggs")).toBeOnTheScreen();
  expect(screen.getByText("3 sources")).toBeOnTheScreen();
});

it("says when a figure is an average, and how far the sources were apart", async () => {
  mockQueries({ detail: detailResult({ data: withTraits }) });

  await render(<SpeciesDetailScreen />);
  await fireEvent.press(screen.getByText("biology"));

  expect(screen.getByText("3.4–3.45 kg · 2 sources")).toBeOnTheScreen();
  // A single-source figure claims nothing.
  expect(screen.queryByText(/1 source/)).toBeNull();
});

it("puts the headline figures under the species name and opens the tab when tapped", async () => {
  mockQueries({ detail: detailResult({ data: withTraits }) });

  await render(<SpeciesDetailScreen />);

  // Value in the header chip, before the tab is opened.
  expect(screen.getByText("4 eggs")).toBeOnTheScreen();
  expect(screen.queryByText("Lifespan")).toBeNull();

  await fireEvent.press(screen.getByText("Clutch size"));
  expect(screen.getByText("Lifespan")).toBeOnTheScreen();
});

it("translates the per-country status, which Avibase only gives us in English", async () => {
  mockQueries({
    detail: detailResult({
      data: {
        ...baseDetail,
        countries: [
          { code: "GB", name: "United Kingdom", segment: "united-kingdom", status: "Rare/Accidental", region: "Northern Europe" },
          { code: "FR", name: "France", segment: "france", status: null, region: "Western Europe" },
        ],
      },
    }),
  });

  await render(<SpeciesDetailScreen />);
  await fireEvent.press(screen.getByText("countries"));

  expect(screen.getByText("country_status_rare_accidental")).toBeOnTheScreen();
  expect(screen.getByText("🇫🇷 France")).toBeOnTheScreen();
});

it("shows the backend's spelled-out range, falling back to the raw IOC shorthand", async () => {
  mockQueries({
    detail: detailResult({
      data: {
        ...baseDetail,
        breeding_subregion: "w, c",
        breeding_subregion_text: "west, central",
        nonbreeding_region: "to n AF",
      },
    }),
  });

  await render(<SpeciesDetailScreen />);

  expect(screen.getByText("west, central")).toBeOnTheScreen();
  expect(screen.getByText(/to n AF/)).toBeOnTheScreen();
});

it("shows translation entries under the backend-localized language name, sorted alphabetically", async () => {
  mockQueries({
    detail: detailResult({
      data: {
        ...baseDetail,
        multilangs: {
          langs: {
            ru: { label: "Russian", names: ["Лазоревка"] },
            zt: { label: "Chinese (Traditional)", names: ["藍山雀"] },
          },
          synonyms: [],
          protonyms: [],
        },
      },
    }),
  });

  await render(<SpeciesDetailScreen />);
  await fireEvent.press(screen.getByText("names"));

  expect(screen.getByText("Russian")).toBeOnTheScreen();
  expect(screen.getByText("Лазоревка")).toBeOnTheScreen();
  expect(screen.getByText("Chinese (Traditional)")).toBeOnTheScreen();
  expect(screen.getByText("藍山雀")).toBeOnTheScreen();
});

it("doesn't crash on a stale-shaped cached translations entry (plain name array instead of {label, names})", async () => {
  mockQueries({
    detail: detailResult({
      data: {
        ...baseDetail,
        multilangs: {
          langs: { ru: ["Лазоревка"] as unknown as { label: string; names: string[] } },
          synonyms: [],
          protonyms: [],
        },
      },
    }),
  });

  await render(<SpeciesDetailScreen />);
  await fireEvent.press(screen.getByText("names"));

  expect(screen.getByText("RU")).toBeOnTheScreen();
});

it("opens the observation editor prefilled with this species when the add-observation FAB is tapped", async () => {
  mockQueries({ detail: detailResult({ data: baseDetail }) });
  await render(<SpeciesDetailScreen />);

  await fireEvent.press(screen.getByTestId("add-observation-fab"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
    defaultSpecies: baseDetail.taxon_id,
    defaultTerritory: 4,
    returnMode: "back",
  });
});

it("hands the species' range to the default-country lookup and passes on its verdict", async () => {
  // A species page is reached from search or a deep link, so the country can
  // only come from the app's own fallback — and only if the bird occurs there.
  (useDefaultTerritory as jest.Mock).mockReturnValue(null);
  mockQueries({ detail: detailResult({ data: baseDetail }) });
  await render(<SpeciesDetailScreen />);

  expect(useDefaultTerritory).toHaveBeenCalledWith(baseDetail.countries);

  await fireEvent.press(screen.getByTestId("add-observation-fab"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
    defaultSpecies: baseDetail.taxon_id,
    defaultTerritory: null,
    returnMode: "back",
  });
});

it("navigates to the parent order when a breadcrumb is tapped", async () => {
  mockQueries({ detail: detailResult({ data: baseDetail }) });
  await render(<SpeciesDetailScreen />);

  await fireEvent.press(screen.getByText("Passeriformes"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("TaxonGroupDetail", {
    segment: "passeriformes",
    rank: 2,
  });
});

it("pushes a new species detail screen when a related species is tapped", async () => {
  mockQueries({
    detail: detailResult({
      data: {
        ...baseDetail,
        related: { count: 1, species: [{ name: "Parus major", name_lang: "Great Tit", segment: "great-tit", thumb: null }] },
      },
    }),
  });

  await render(<SpeciesDetailScreen />);
  await fireEvent.press(screen.getByText("Great Tit"));
  expect(mockNavigation.push).toHaveBeenCalledWith("SpeciesDetail", { segment: "great-tit" });
});

it("navigates to the genus listing when 'show all related species' is tapped", async () => {
  mockQueries({
    detail: detailResult({
      data: {
        ...baseDetail,
        parents: [
          ...baseDetail.parents,
          { depth: 4, parent_name: "Parus", parent_name_lang: "Parus", parent_segment: "parus" },
        ],
        related: {
          count: 31,
          species: [{ name: "Parus major", name_lang: "Great Tit", segment: "great-tit", thumb: null }],
        },
      },
    }),
  });

  await render(<SpeciesDetailScreen />);
  await fireEvent.press(screen.getByText("all_related_species:{\"count\":31}"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("TaxonGroupDetail", {
    segment: "parus",
    rank: 4,
  });
});

it("pushes the next species in the paging strip when tapped", async () => {
  mockQueries({
    detail: detailResult({
      data: {
        ...baseDetail,
        paging: { prev: null, next: { segment: "great-tit", name: "Parus major", name_lang: "Great Tit" } },
      },
    }),
  });

  await render(<SpeciesDetailScreen />);
  await fireEvent.press(screen.getByText("Great Tit"));
  expect(mockNavigation.push).toHaveBeenCalledWith("SpeciesDetail", { segment: "great-tit" });
});

// The page is one long read split into tabs, so a link shared from one of them
// should open there (see buildSpeciesDetailUrl / linking.ts).
it("opens on the tab a shared link was sent from", async () => {
  mockRoute = createRouteMock("SpeciesDetail", {
    segment: "blue-tit",
    initialTab: "countries",
  });
  mockQueries({ detail: detailResult({ data: baseDetail }) });

  await render(<SpeciesDetailScreen />);

  expect(screen.getByText("🇬🇧 United Kingdom")).toBeOnTheScreen();
});

// Half the tabs only exist when the species has that content, so a link asking
// for one this bird lacks would otherwise leave the page blank.
it("falls back to the overview when the shared tab has nothing to show", async () => {
  mockRoute = createRouteMock("SpeciesDetail", {
    segment: "blue-tit",
    initialTab: "sounds",
  });
  mockQueries({ detail: detailResult({ data: baseDetail }) });

  await render(<SpeciesDetailScreen />);

  expect(screen.getByText("Blue Tit")).toBeOnTheScreen();
  // No sounds tab to select, and the overview rendered in its place.
  expect(screen.queryByText("sounds")).toBeNull();
});

it("shares the species page on the tab it was read from", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({
    action: "sharedAction",
  } as never);
  mockQueries({ detail: detailResult({ data: baseDetail }) });

  await render(<SpeciesDetailScreen />);
  await fireEvent.press(screen.getByText("countries"));
  const options = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0];
  await options.headerRight().props.onSharePress();

  const arg = shareSpy.mock.calls[0][0] as { url?: string; message?: string };
  expect(arg.url ?? arg.message ?? "").toContain(
    "/species/blue-tit/?tab=countries",
  );
});
