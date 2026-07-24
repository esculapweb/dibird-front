jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import TaxonBreadcrumbs from "../TaxonBreadcrumbs";
import { TaxonParentCrumb } from "../../../types";

const mockNavigation = createNavigationMock();

const PARENTS: TaxonParentCrumb[] = [
  {
    depth: 2,
    parent_name: "Accipitriformes",
    parent_name_lang: "Ястребообразные",
    parent_segment: "accipitriformes",
  },
  {
    depth: 3,
    parent_name: "Pandionidae",
    parent_name_lang: "Скопиные",
    parent_segment: "pandionidae",
  },
];

beforeEach(() => jest.clearAllMocks());

it("shows the parent taxa in order", async () => {
  await render(<TaxonBreadcrumbs parents={PARENTS} />);

  expect(screen.getByText("Ястребообразные")).toBeOnTheScreen();
  expect(screen.getByText("Скопиные")).toBeOnTheScreen();
});

it("separates the crumbs, but does not open the trail with a separator", async () => {
  // Without the dot the names ran together into one word on the device.
  await render(<TaxonBreadcrumbs parents={PARENTS} />);

  expect(screen.getAllByText("·")).toHaveLength(PARENTS.length - 1);
});

it("renders nothing for a taxon that has no parents", async () => {
  const { toJSON } = await render(<TaxonBreadcrumbs parents={[]} />);

  expect(toJSON()).toBeNull();
});

it("opens a crumb at its own rank, not the one of the taxon shown", async () => {
  await render(<TaxonBreadcrumbs parents={PARENTS} />);

  await fireEvent.press(screen.getByText("Скопиные"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("TaxonGroupDetail", {
    segment: "pandionidae",
    rank: 3,
  });
});
