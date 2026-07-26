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
    Ionicons: ({ name }: { name: string }) => (
      <Text testID={`icon-${name}`}>{name}</Text>
    ),
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import TerritoryRow from "../TerritoryRow";
import { TerritoryListItem } from "../../../types";

const makeItem = (
  overrides: Partial<TerritoryListItem> = {},
): TerritoryListItem => ({
  name: "Argentina",
  segment: "argentina",
  code: "AR",
  region_name: null,
  short: null,
  count: null,
  ...overrides,
});

it("shows the country flag, its name and the species count", async () => {
  await render(
    <TerritoryRow
      item={makeItem({ count: { "5": "1111 species" } })}
      onPress={jest.fn()}
    />,
  );

  expect(screen.getByText("Argentina")).toBeOnTheScreen();
  expect(screen.getByText("1111 species")).toBeOnTheScreen();
  // "AR" as regional-indicator letters.
  expect(screen.getByText("🇦🇷")).toBeOnTheScreen();
});

it("names the region between the country and its species count", async () => {
  await render(
    <TerritoryRow
      item={makeItem({
        region_name: "South America",
        count: { "5": "1111 species" },
      })}
      onPress={jest.fn()}
    />,
  );

  expect(screen.getByText("region: South America")).toBeOnTheScreen();
});

it("leaves the region line out for a row cached before the API sent one", async () => {
  await render(<TerritoryRow item={makeItem()} onPress={jest.fn()} />);

  expect(screen.queryByText(/region/)).toBeNull();
});

it("falls back to a globe for the territories that have no ISO code", async () => {
  await render(
    <TerritoryRow
      item={makeItem({ name: "High Seas", segment: "high-seas", code: null })}
      onPress={jest.fn()}
    />,
  );

  expect(screen.getByTestId("icon-globe-outline")).toBeOnTheScreen();
});

it("leaves the second line out when the count is missing", async () => {
  // The count comes from a precomputed table and is occasionally absent.
  await render(
    <TerritoryRow
      item={makeItem({ name: "Austria", segment: "austria", code: "AT" })}
      onPress={jest.fn()}
    />,
  );

  expect(screen.getByText("Austria")).toBeOnTheScreen();
  expect(screen.queryByText(/species/)).toBeNull();
});

it("hands the tapped country to the list", async () => {
  const onPress = jest.fn();
  const item = makeItem({ name: "Austria", segment: "austria", code: "AT" });
  await render(<TerritoryRow item={item} onPress={onPress} />);

  await fireEvent.press(screen.getByText("Austria"));
  expect(onPress).toHaveBeenCalledWith(item);
});
