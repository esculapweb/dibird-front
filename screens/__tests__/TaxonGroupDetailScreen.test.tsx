// jest.config.js's setupFiles path only evaluates the async-storage mock
// without wiring it up as a replacement — the sort preference reads it.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
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
jest.mock("../../hooks/useContentWidth", () => ({ useContentWidth: () => 400 }));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => <View testID="hero" {...props} />,
  };
});
jest.mock("react-native-render-html", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ source }: { source: { html: string } }) => (
      <Text>{source.html}</Text>
    ),
  };
});
jest.mock("../../components/ui/IconsHeader", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="icons-header" /> };
});
jest.mock("../../components/Taxonomy/TaxonBreadcrumbs", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ parents }: { parents: { parent_segment: string }[] }) => (
      <Text testID="breadcrumbs">{parents.map((p) => p.parent_segment).join(",")}</Text>
    ),
  };
});
jest.mock("../../components/Taxonomy/TaxonChildrenList", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockChildrenListProps = props;
      return (
        <View testID="children-list">{props.listHeader as never}</View>
      );
    },
  };
});
jest.mock("../../components/Taxonomy/TaxonDescendantsList", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockDescendantsListProps = props;
      return (
        <View testID="descendants-list">
          {props.listHeader as never}
        </View>
      );
    },
  };
});

import { render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import { createNavigationMock, createRouteMock } from "../test-utils";
import TaxonGroupDetailScreen from "../TaxonGroupDetailScreen";
import { TaxonGroupDetail } from "../../types";

let mockRoute: ReturnType<typeof createRouteMock>;
let mockChildrenListProps: Record<string, unknown>;
let mockDescendantsListProps: Record<string, unknown>;
const mockNavigation = createNavigationMock();
const mockUseQuery = useQuery as jest.Mock;

const baseDetail: TaxonGroupDetail = {
  taxon_id: 726,
  name: "Ospreys / Pandionidae",
  name_lang: "Ospreys",
  latin_name: "Pandionidae",
  segment: "ospreys",
  extinct: false,
  metadata: {
    title: "",
    meta_description: "",
    h1: "",
    short: "<p>A family of one.</p>",
    image: "https://live.staticflickr.com/1/2_c.jpg",
  },
  alternates: [],
  count: { "5": "1 species", "4": "1 genus" },
  paging: { prev: null, next: null },
  parents: [
    {
      depth: 2,
      parent_name: "Accipitriformes",
      parent_name_lang: "Hawks and relatives",
      parent_segment: "hawks-and-relatives",
    },
  ],
  descendants: [
    {
      depth: 4,
      numchild: 1,
      thumb: null,
      d_name: "Pandion",
      d_name_lang: "Pandion",
      d_segment: "pandion",
      d_status: null,
      s_id: null,
    },
    {
      depth: 5,
      numchild: 4,
      thumb: "taxon/1a/2e/27921210917.jpg",
      d_name: "Osprey / Pandion haliaetus",
      d_name_lang: "Osprey",
      d_segment: "osprey",
      d_status: "LC",
      s_id: 9,
    },
  ],
};

const mockDetail = (overrides: Record<string, unknown> = {}) =>
  mockUseQuery.mockReturnValue({
    data: baseDetail,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = createRouteMock("TaxonGroupDetail", {
    segment: "ospreys",
    rank: 3,
  });
  mockDetail();
});

it("renders the hero, breadcrumbs, name, latin name and counts", async () => {
  await render(<TaxonGroupDetailScreen />);

  // Two layers: a blurred fill behind the whole, uncropped photo.
  const [backdrop, photo] = screen.getAllByTestId("hero");
  expect(backdrop.props.source).toEqual({
    uri: "https://live.staticflickr.com/1/2_c.jpg",
  });
  expect(backdrop.props.blurRadius).toBe(30);
  expect(photo.props.contentFit).toBe("contain");
  expect(screen.getByTestId("breadcrumbs")).toHaveTextContent(
    "hawks-and-relatives",
  );
  expect(screen.getByText("Ospreys")).toBeOnTheScreen();
  expect(screen.getByText("Pandionidae")).toBeOnTheScreen();
  expect(screen.getByText("1 genus")).toBeOnTheScreen();
  expect(screen.getByText("1 species")).toBeOnTheScreen();
});

it("lists a family's species grouped by genus, straight from the detail response", async () => {
  await render(<TaxonGroupDetailScreen />);

  expect(screen.getByTestId("descendants-list")).toBeOnTheScreen();
  expect(screen.queryByTestId("children-list")).toBeNull();
  expect(mockDescendantsListProps.descendants).toEqual(baseDetail.descendants);
  expect(mockDescendantsListProps.showGroupHeaders).toBe(true);
});

it("drops the genus headers on a genus page", async () => {
  mockRoute = createRouteMock("TaxonGroupDetail", {
    segment: "pandion",
    rank: 4,
  });

  await render(<TaxonGroupDetailScreen />);

  expect(mockDescendantsListProps.showGroupHeaders).toBe(false);
});

it("falls back to the paginated family list on an order page, which carries no descendants", async () => {
  mockRoute = createRouteMock("TaxonGroupDetail", {
    segment: "hawks-and-relatives",
    rank: 2,
  });
  mockDetail({ data: { ...baseDetail, descendants: [] } });

  await render(<TaxonGroupDetailScreen />);

  expect(screen.getByTestId("children-list")).toBeOnTheScreen();
  expect(screen.queryByTestId("descendants-list")).toBeNull();
  expect(mockChildrenListProps.rank).toBe(3);
  expect(mockChildrenListProps.parent).toEqual({
    segment: "hawks-and-relatives",
    rank: 2,
  });
});

it("borrows a species photo for the hero when the taxon has no image of its own", async () => {
  mockDetail({
    data: { ...baseDetail, metadata: { ...baseDetail.metadata, image: null } },
  });

  await render(<TaxonGroupDetailScreen />);

  expect(screen.getAllByTestId("hero")[0].props.source).toEqual({
    uri: "https://test.local/media/taxon/1a/2e/27921210917.jpg",
  });
});

it("shows an error overlay with retry when the detail fetch fails and there is nothing cached", async () => {
  const refetch = jest.fn();
  mockDetail({
    data: undefined,
    isError: true,
    error: { message: "boom" },
    refetch,
  });

  await render(<TaxonGroupDetailScreen />);
  expect(screen.getByText("taxonomy_unavailable")).toBeOnTheScreen();
});

it("redirects to the canonical segment via setParams when the API returns a redirect", async () => {
  mockDetail({ data: { ...baseDetail, redirect: "skopinye" } });

  await render(<TaxonGroupDetailScreen />);

  expect(mockNavigation.setParams).toHaveBeenCalledWith({
    segment: "skopinye",
  });
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});
