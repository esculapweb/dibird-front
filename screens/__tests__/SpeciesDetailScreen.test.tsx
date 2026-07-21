jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
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

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { createNavigationMock, createRouteMock } from "../test-utils";
import SpeciesDetailScreen from "../SpeciesDetailScreen";
import { TaxonSpeciesDetail } from "../../types";

let mockRoute: ReturnType<typeof createRouteMock>;
const mockNavigation = createNavigationMock();
const mockUseQuery = useQuery as jest.Mock;

const baseDetail: TaxonSpeciesDetail = {
  taxon_id: 1,
  name: "Cyanistes caeruleus",
  name_lang: "Blue Tit",
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
  status: { status_id: 1, name: "Least Concern", s_id: 1 },
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
  mockQueries({
    detail: detailResult({ data: { ...baseDetail, redirect: "eurasian-blue-tit" } }),
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
  expect(screen.getByText("🇬🇧 United Kingdom")).toBeOnTheScreen();
  expect(screen.getByText("C. c. ogliastrae, Hartert, 1901")).toBeOnTheScreen();
  expect(screen.getByText("Passeriformes")).toBeOnTheScreen();
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
  await fireEvent.press(screen.getByText("Great Tit →"));
  expect(mockNavigation.push).toHaveBeenCalledWith("SpeciesDetail", { segment: "great-tit" });
});
