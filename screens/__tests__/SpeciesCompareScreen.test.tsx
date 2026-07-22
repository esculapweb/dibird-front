jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => (
      <View>{children}</View>
    ),
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("../../util/fetches", () => ({ fetchTaxonDetail: jest.fn() }));
jest.mock("../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{`icon-${name}`}</Text>,
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { createNavigationMock, createRouteMock } from "../test-utils";
import SpeciesCompareScreen from "../SpeciesCompareScreen";
import { callNavigationCallback } from "../../util/navigationCallbacks";

let mockRoute: ReturnType<typeof createRouteMock>;
const mockNavigation = createNavigationMock();
const mockUseQuery = useQuery as jest.Mock;

const species = (
  name: string,
  segment: string,
  mass: number,
  massLabel: string,
  habitat: string,
) => ({
  name_lang: name,
  latin_name: `Latin ${name}`,
  segment,
  status: { status_id: "LC", name: "Least Concern", s_id: 9 },
  photos: [],
  traits: [
    {
      key: "BODY",
      label: "Measurements",
      traits: [
        {
          key: "MASS",
          label: "Body mass",
          value: massLabel,
          num: mass,
          sample_size: 2,
          spread: "",
          sources_label: "2 sources",
          male: null,
          female: null,
          source: "Myhrvold et al. 2015",
          source_url: null,
        },
      ],
    },
    {
      key: "HABITAT",
      label: "Habitat and range",
      traits: [
        {
          key: "HABITAT",
          label: "Habitat",
          value: habitat,
          num: null,
          sample_size: 1,
          spread: "",
          sources_label: "",
          male: null,
          female: null,
          source: "Tobias et al. 2021",
          source_url: null,
        },
      ],
    },
  ],
});

const STORK = species("White Stork", "white-stork", 3350, "3.35 kg", "Grassland");
const WREN = species("Eurasian Wren", "eurasian-wren", 9.2, "9.2 g", "Forest");

// The screen runs one query per side, keyed by its segment.
const mockDetails = (bySegment: Record<string, unknown>) => {
  mockUseQuery.mockImplementation((opts: { queryKey: unknown[] }) => ({
    data: bySegment[opts.queryKey[1] as string],
  }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = createRouteMock("SpeciesCompare", undefined);
  mockDetails({});
});

it("asks for two species before it can compare anything", async () => {
  await render(<SpeciesCompareScreen />);

  expect(screen.getByText("compare_hint")).toBeOnTheScreen();
  expect(screen.getAllByText("pick_species")).toHaveLength(2);
});

it("keeps the species it was opened with, so 'compare this bird' starts filled in", async () => {
  mockRoute = createRouteMock("SpeciesCompare", { segmentA: "white-stork" });
  mockDetails({ "white-stork": STORK });

  await render(<SpeciesCompareScreen />);

  expect(screen.getByText("White Stork")).toBeOnTheScreen();
  expect(screen.getByText("pick_species")).toBeOnTheScreen();
  expect(screen.getByText("compare_hint")).toBeOnTheScreen();
});

it("opens the species picker and takes the pick into the empty slot", async () => {
  mockRoute = createRouteMock("SpeciesCompare", { segmentA: "white-stork" });
  mockDetails({ "white-stork": STORK });

  await render(<SpeciesCompareScreen />);
  await fireEvent.press(screen.getByTestId("compare-pick-b"));

  expect(mockNavigation.push).toHaveBeenCalledWith("Taxonomy", {
    rank: 5,
    title: "pick_species",
    focusSearch: true,
    pickerKey: "species-compare-b",
  });

  mockDetails({ "white-stork": STORK, "eurasian-wren": WREN });
  await callNavigationCallback("species-compare-b", { segment: "eurasian-wren" });

  expect(await screen.findByText("Eurasian Wren")).toBeOnTheScreen();
});

it("lines both species up trait by trait and marks the larger figure", async () => {
  mockRoute = createRouteMock("SpeciesCompare", {
    segmentA: "white-stork",
    segmentB: "eurasian-wren",
  });
  mockDetails({ "white-stork": STORK, "eurasian-wren": WREN });

  await render(<SpeciesCompareScreen />);

  expect(screen.getByText("Measurements")).toBeOnTheScreen();
  expect(screen.getByText("3.35 kg")).toBeOnTheScreen();
  expect(screen.getByText("9.2 g")).toBeOnTheScreen();
  // A formatted value can't be compared as text ("9.2 g" > "3.35 kg"), so the
  // winner comes from the raw number the API sends alongside it.
  const heavier = screen.getByText("3.35 kg");
  expect(heavier.props.style.flat()).toContainEqual(
    expect.objectContaining({ fontWeight: "700" }),
  );
});

it("shows a dash where only one of the two species has the trait", async () => {
  mockRoute = createRouteMock("SpeciesCompare", {
    segmentA: "white-stork",
    segmentB: "eurasian-wren",
  });
  mockDetails({
    "white-stork": STORK,
    "eurasian-wren": { ...WREN, traits: [WREN.traits[0]] },
  });

  await render(<SpeciesCompareScreen />);

  expect(screen.getByText("Grassland")).toBeOnTheScreen();
  expect(screen.getByText("—")).toBeOnTheScreen();
});
