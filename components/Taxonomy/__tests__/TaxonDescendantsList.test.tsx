jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name, testID }: { name: string; testID?: string }) => (
      <Text testID={testID ?? `icon-${name}`}>{name}</Text>
    ),
  };
});
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: (props: Record<string, unknown>) => <View {...props} /> };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: () => <View testID="thumb-placeholder" /> };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import TaxonDescendantsList from "../TaxonDescendantsList";
import { TaxonDescendant } from "../../../types";

const mockNavigation = createNavigationMock();

const descendant = (
  depth: number,
  name: string,
  nameLang: string,
  segment: string,
  status: string | null = null,
): TaxonDescendant => ({
  depth,
  numchild: 0,
  thumb: null,
  d_name: name,
  d_name_lang: nameLang,
  d_segment: segment,
  d_status: status,
  s_id: null,
});

// The shape a family detail returns: each genus is immediately followed by
// its own species.
const DESCENDANTS: TaxonDescendant[] = [
  descendant(4, "Pandion", "Pandion", "pandion"),
  descendant(5, "Osprey / Pandion haliaetus", "Osprey", "osprey", "LC"),
  descendant(4, "Aquila", "Aquila", "aquila"),
  descendant(5, "Golden Eagle / Aquila chrysaetos", "Golden Eagle", "golden-eagle", "LC"),
  descendant(5, "Spanish Imperial Eagle / Aquila adalberti", "Spanish Imperial Eagle", "spanish-imperial-eagle", "VU"),
];

beforeEach(() => jest.clearAllMocks());

const renderList = (props: Partial<React.ComponentProps<typeof TaxonDescendantsList>> = {}) =>
  render(
    <TaxonDescendantsList
      descendants={DESCENDANTS}
      showGroupHeaders
      emptyMessage="no_species_found"
      {...props}
    />,
  );

it("groups species under their genus, showing the localized name and the latin one below", async () => {
  await renderList();

  expect(screen.getByText("Pandion")).toBeOnTheScreen();
  expect(screen.getByText("Aquila")).toBeOnTheScreen();
  expect(screen.getByText("Osprey")).toBeOnTheScreen();
  expect(screen.getByText("Pandion haliaetus")).toBeOnTheScreen();
  expect(screen.getByText("Aquila chrysaetos")).toBeOnTheScreen();
});

it("shows the IUCN category of the threatened species only", async () => {
  // "Least concern" is most of any list, so its badge said nothing and cost
  // the species name its width (see isNotableIucn).
  await renderList();

  expect(screen.getByText("VU")).toBeOnTheScreen();
  expect(screen.queryByText("LC")).toBeNull();
});

it("hides the genus headers on a genus page, where they would only repeat the title", async () => {
  await renderList({ showGroupHeaders: false });

  expect(screen.queryByText("Pandion")).toBeNull();
  expect(screen.getByText("Osprey")).toBeOnTheScreen();
});

it("opens the species when a row is tapped", async () => {
  await renderList();

  await fireEvent.press(screen.getByText("Osprey"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("SpeciesDetail", {
    segment: "osprey",
  });
});

it("opens the genus when its header is tapped", async () => {
  await renderList();

  await fireEvent.press(screen.getByText("Aquila"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("TaxonGroupDetail", {
    segment: "aquila",
    rank: 4,
  });
});

it("filters species locally and drops the genera left without matches", async () => {
  await renderList();

  await fireEvent.changeText(screen.getByPlaceholderText("search"), "imperial");

  expect(screen.getByText("Spanish Imperial Eagle")).toBeOnTheScreen();
  expect(screen.queryByText("Osprey")).toBeNull();
  expect(screen.queryByText("Pandion")).toBeNull();
  expect(screen.getByText("Aquila")).toBeOnTheScreen();
});

it("keeps the whole genus when the genus name itself matches", async () => {
  await renderList();

  await fireEvent.changeText(screen.getByPlaceholderText("search"), "aquila");

  expect(screen.getByText("Golden Eagle")).toBeOnTheScreen();
  expect(screen.getByText("Spanish Imperial Eagle")).toBeOnTheScreen();
  expect(screen.queryByText("Osprey")).toBeNull();
});

it("offers to reset the search when nothing matches", async () => {
  await renderList();

  await fireEvent.changeText(screen.getByPlaceholderText("search"), "penguin");
  expect(screen.getByText("nothing_found")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("reset_filters"));
  expect(screen.getByText("Osprey")).toBeOnTheScreen();
});

// Rendered order of the names we care about, top to bottom.
const renderedOrder = () =>
  screen
    .getAllByText(/^(Pandion|Aquila|Osprey|Golden Eagle|Spanish Imperial Eagle)$/)
    .map((node) => node.props.children as string);

it("keeps the checklist order the family detail came in", async () => {
  await renderList({ sort: "ioc_id" });

  const order = renderedOrder();
  expect(order.indexOf("Pandion")).toBeLessThan(order.indexOf("Aquila"));
});

it("sorts genera and the species inside them alphabetically on request", async () => {
  await renderList({ sort: "name" });

  const order = renderedOrder();
  expect(order.indexOf("Aquila")).toBeLessThan(order.indexOf("Pandion"));
  expect(order.indexOf("Golden Eagle")).toBeLessThan(
    order.indexOf("Spanish Imperial Eagle"),
  );
});

it("shows the empty message when the taxon has no species at all", async () => {
  await renderList({ descendants: [] });

  expect(screen.getByText("no_species_found")).toBeOnTheScreen();
});
