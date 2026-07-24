jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));

import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import TerritoryCompareRow from "../TerritoryCompareRow";
import { mockColors } from "../../../screens/mockTheme";
import { TerritoryCompareSpecies } from "../../../types";

const species = (
  overrides: Partial<TerritoryCompareSpecies> = {},
): TerritoryCompareSpecies => ({
  name: "Greater Rhea / Rhea americana",
  name_lang: "Greater Rhea",
  segment: "greater-rhea",
  status: "NT",
  in_object: [true, false],
  ...overrides,
});

const dotColor = (side: 0 | 1) =>
  StyleSheet.flatten(screen.getByTestId(`presence-dot-${side}`).props.style)
    .backgroundColor;

it("shows the localized name with the latin one below and the IUCN category", async () => {
  await render(<TerritoryCompareRow item={species()} onPress={jest.fn()} />);

  expect(screen.getByText("Greater Rhea")).toBeOnTheScreen();
  expect(screen.getByText("Rhea americana")).toBeOnTheScreen();
  expect(screen.getByText("NT")).toBeOnTheScreen();
});

it("fills one dot per country that has the species", async () => {
  await render(<TerritoryCompareRow item={species()} onPress={jest.fn()} />);

  expect(dotColor(0)).toBe(mockColors.compareP1);
  // Absent from the second country, so its dot stays blank.
  expect(dotColor(1)).toBe(mockColors.imageBg);
});

it("fills both dots for a species the two countries share", async () => {
  await render(
    <TerritoryCompareRow
      item={species({ in_object: [true, true] })}
      onPress={jest.fn()}
    />,
  );

  expect(dotColor(0)).toBe(mockColors.compareP1);
  expect(dotColor(1)).toBe(mockColors.compareP2);
});

it("leaves the badge out for a species with no IUCN category", async () => {
  await render(
    <TerritoryCompareRow item={species({ status: null })} onPress={jest.fn()} />,
  );

  expect(screen.getByText("Greater Rhea")).toBeOnTheScreen();
  expect(screen.queryByText("NT")).toBeNull();
});

it("opens the species page when tapped", async () => {
  const onPress = jest.fn();
  await render(<TerritoryCompareRow item={species()} onPress={onPress} />);

  await fireEvent.press(screen.getByText("Greater Rhea"));
  expect(onPress).toHaveBeenCalled();
});
