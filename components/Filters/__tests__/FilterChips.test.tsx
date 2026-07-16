jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});

const mockUseFilterLabels = jest.fn();
jest.mock("../../../hooks/useFilterLabels", () => ({
  useFilterLabels: (...args: unknown[]) => mockUseFilterLabels(...args),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import FilterChips from "../FilterChips";
import { AllFiltersKey, AllowedFilterKey, Filters } from "../../../types";

const mockOnRemove = jest.fn();

const getFilterLabel = jest.fn(
  (key: AllFiltersKey, value: unknown): [string, string] => [String(key), String(value)],
);

const ALL_ALLOWED: AllowedFilterKey[] = ["territory", "date", "place", "species", "favourite"];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseFilterLabels.mockReturnValue({ getFilterLabel });
});

it("renders nothing for a null/non-object filters value", async () => {
  await render(
    <FilterChips filters={null as never} onRemove={mockOnRemove} hints={{}} allowed={ALL_ALLOWED} />,
  );
  expect(screen.queryByText("territory")).not.toBeOnTheScreen();
});

it("renders nothing when there are no active filters", async () => {
  await render(<FilterChips filters={{}} onRemove={mockOnRemove} hints={{}} allowed={ALL_ALLOWED} />);
  expect(screen.queryByText("territory")).not.toBeOnTheScreen();
});

it("excludes null/undefined values and empty arrays from the active set", async () => {
  await render(
    <FilterChips
      filters={{ territory: null, place: undefined, tab: [] as unknown as Filters["tab"] }}
      onRemove={mockOnRemove}
      hints={{}}
      allowed={ALL_ALLOWED}
    />,
  );
  expect(screen.queryByText("territory")).not.toBeOnTheScreen();
  expect(screen.queryByText("place")).not.toBeOnTheScreen();
  expect(screen.queryByText("tab")).not.toBeOnTheScreen();
});

it("renders one chip per active, allowed filter using getFilterLabel", async () => {
  await render(
    <FilterChips
      filters={{ territory: 5, favourite: true }}
      onRemove={mockOnRemove}
      hints={{}}
      allowed={ALL_ALLOWED}
    />,
  );
  expect(screen.getByText("territory:", { exact: false })).toBeOnTheScreen();
  expect(screen.getByText("5")).toBeOnTheScreen();
  expect(screen.getByText("favourite:", { exact: false })).toBeOnTheScreen();
  expect(screen.getByText("true")).toBeOnTheScreen();
});

it("excludes a value that's technically set but not in `allowed`", async () => {
  await render(
    <FilterChips
      filters={{ territory: 5, species: 3 }}
      onRemove={mockOnRemove}
      hints={{}}
      allowed={["territory"] as AllowedFilterKey[]}
    />,
  );
  expect(screen.getByText("5")).toBeOnTheScreen();
  expect(screen.queryByText("3")).not.toBeOnTheScreen();
});

it("calls onRemove with the filter key when a chip's close icon is pressed", async () => {
  await render(
    <FilterChips filters={{ territory: 5 }} onRemove={mockOnRemove} hints={{}} allowed={ALL_ALLOWED} />,
  );
  await fireEvent.press(screen.getByTestId("remove-filter-territory"));
  expect(mockOnRemove).toHaveBeenCalledWith("territory");
});

describe("effectiveTerritory resolution", () => {
  it("uses filters.territory when present", async () => {
    await render(
      <FilterChips
        filters={{ territory: 5, place: 9 }}
        extraFilters={{ territory: 99 }}
        onRemove={mockOnRemove}
        hints={{}}
        allowed={ALL_ALLOWED}
      />,
    );
    expect(mockUseFilterLabels).toHaveBeenCalledWith(5, {});
  });

  it("falls back to extraFilters.territory when filters.territory is absent", async () => {
    await render(
      <FilterChips
        filters={{ place: 9 }}
        extraFilters={{ territory: 99 }}
        onRemove={mockOnRemove}
        hints={{}}
        allowed={ALL_ALLOWED}
      />,
    );
    expect(mockUseFilterLabels).toHaveBeenCalledWith(99, {});
  });

  it("falls back to null when neither is set", async () => {
    await render(
      <FilterChips filters={{ place: 9 }} onRemove={mockOnRemove} hints={{}} allowed={ALL_ALLOWED} />,
    );
    expect(mockUseFilterLabels).toHaveBeenCalledWith(null, {});
  });

  it("forwards hints through to useFilterLabels", async () => {
    await render(
      <FilterChips
        filters={{ species: 3 }}
        onRemove={mockOnRemove}
        hints={{ speciesName: "Robin" }}
        allowed={ALL_ALLOWED}
      />,
    );
    expect(mockUseFilterLabels).toHaveBeenCalledWith(null, { speciesName: "Robin" });
  });
});
