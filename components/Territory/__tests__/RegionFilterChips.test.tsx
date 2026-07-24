jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("../../../store/language-context", () => ({
  useLanguage: () => ({ language: "en" }),
}));
jest.mock("@tanstack/react-query", () => ({ useQuery: jest.fn() }));
jest.mock("../../../util/fetches", () => ({
  fetchTerritoryRegions: jest.fn(),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { useQuery } from "@tanstack/react-query";
import RegionFilterChips from "../RegionFilterChips";

const mockUseQuery = useQuery as jest.Mock;

const REGIONS = [
  { id: 15, label: "South America" },
  { id: 21, label: "Western Europe" },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuery.mockReturnValue({ data: REGIONS });
});

it("offers every region plus an all-countries option", async () => {
  await render(<RegionFilterChips value={null} onChange={jest.fn()} />);

  expect(screen.getByText("all")).toBeOnTheScreen();
  expect(screen.getByText("South America")).toBeOnTheScreen();
  expect(screen.getByText("Western Europe")).toBeOnTheScreen();
});

it("picks a region", async () => {
  const onChange = jest.fn();
  await render(<RegionFilterChips value={null} onChange={onChange} />);

  await fireEvent.press(screen.getByText("South America"));

  expect(onChange).toHaveBeenCalledWith(15);
});

it("clears the region when the active chip is tapped again", async () => {
  // Saves a separate reset control on a strip that is already scrollable.
  const onChange = jest.fn();
  await render(<RegionFilterChips value={15} onChange={onChange} />);

  await fireEvent.press(screen.getByText("South America"));

  expect(onChange).toHaveBeenCalledWith(null);
});

it("clears the region from the all-countries chip", async () => {
  const onChange = jest.fn();
  await render(<RegionFilterChips value={15} onChange={onChange} />);

  await fireEvent.press(screen.getByText("all"));

  expect(onChange).toHaveBeenCalledWith(null);
});

it("stays out of the way until the regions are in", async () => {
  // A lone "All" chip that filters nothing is worse than no strip at all.
  mockUseQuery.mockReturnValue({ data: undefined });

  await render(<RegionFilterChips value={null} onChange={jest.fn()} />);

  expect(screen.queryByTestId("region-chips")).toBeNull();
});
