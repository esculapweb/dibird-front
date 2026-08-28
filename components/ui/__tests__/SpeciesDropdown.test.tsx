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
  return {
    Image: ({ source }: { source: { uri: string } }) => (
      <View testID="species-image" accessibilityValue={{ text: source.uri }} />
    ),
  };
});
jest.mock("../../../hooks/useOpenSpecies", () => ({
  useOpenSpecies: () => mockOpenSpecies,
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import SpeciesDropdown from "../SpeciesDropdown";
import { QueryType, SpeciesDropdownItem } from "../../../types";

const mockOpenSpecies = jest.fn();
const mockOnPress = jest.fn();
const mockRefetch = jest.fn();

const baseQuery = (overrides: Partial<QueryType> = {}): QueryType => ({
  data: [],
  isLoading: false,
  isError: false,
  refetch: mockRefetch,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("loading", () => {
  it("shows a spinner and loading text, and still fires onPress on tap", async () => {
    await render(
      <SpeciesDropdown query={baseQuery({ isLoading: true })} onPress={mockOnPress} value={null} />,
    );
    expect(screen.getByText("loading_")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("species-dropdown-trigger"));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("hides the chevron while loading", async () => {
    await render(
      <SpeciesDropdown query={baseQuery({ isLoading: true })} onPress={mockOnPress} value={null} />,
    );
    expect(screen.queryByText("chevron-forward")).not.toBeOnTheScreen();
  });
});

describe("error", () => {
  it("shows a retry icon and error text, and refetches instead of calling onPress", async () => {
    await render(
      <SpeciesDropdown query={baseQuery({ isError: true })} onPress={mockOnPress} value={null} />,
    );
    expect(screen.getByText("failed_to_load_data")).toBeOnTheScreen();
    expect(screen.getByText("refresh")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("species-dropdown-trigger"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockOnPress).not.toHaveBeenCalled();
  });
});

describe("selected with a thumbnail", () => {
  const speciesData: SpeciesDropdownItem = {
    value: 3,
    label: "Blue Tit",
    name_lang: "Blue Tit",
    name: "Cyanistes caeruleus",
    thumb: "species/3/thumb.jpg",
    segment: "blue-tit",
  };

  it("shows the image, translated name, latin name, and tap hint", async () => {
    await render(
      <SpeciesDropdown query={baseQuery()} onPress={mockOnPress} value={3} speciesData={speciesData} />,
    );
    expect(screen.getByTestId("species-image").props.accessibilityValue.text).toBe(
      "https://test.local/media/species/3/thumb.jpg",
    );
    expect(screen.getByText("Blue Tit")).toBeOnTheScreen();
    expect(screen.getByText("Cyanistes caeruleus")).toBeOnTheScreen();
    expect(screen.getByText("tap_to_change")).toBeOnTheScreen();
  });

  it("opens species details when the info corner button is pressed", async () => {
    await render(
      <SpeciesDropdown query={baseQuery()} onPress={mockOnPress} value={3} speciesData={speciesData} />,
    );
    await fireEvent.press(screen.getByText("information-circle-outline"));
    expect(mockOpenSpecies).toHaveBeenCalledWith("blue-tit", "observation_editor");
  });

  it("omits the latin name when it's identical to the display name", async () => {
    await render(
      <SpeciesDropdown
        query={baseQuery()}
        onPress={mockOnPress}
        value={3}
        speciesData={{ ...speciesData, name: "Blue Tit" }}
      />,
    );
    expect(screen.queryByText("Cyanistes caeruleus")).not.toBeOnTheScreen();
  });
});

describe("selected without a thumbnail", () => {
  it("shows a placeholder bird icon and still opens species details", async () => {
    const speciesData: SpeciesDropdownItem = {
      value: 4,
      label: "Robin",
      name: "Erithacus rubecula",
      segment: "robin",
    };
    await render(
      <SpeciesDropdown query={baseQuery()} onPress={mockOnPress} value={4} speciesData={speciesData} />,
    );
    expect(screen.queryByTestId("species-image")).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByText("information-circle-outline"));
    expect(mockOpenSpecies).toHaveBeenCalledWith("robin", "observation_editor");
  });
});

describe("empty (nothing selected)", () => {
  it("prompts to select a species when enabled", async () => {
    await render(<SpeciesDropdown query={baseQuery()} onPress={mockOnPress} value={null} />);
    expect(screen.getByText("select_species")).toBeOnTheScreen();
    expect(screen.getByText("species_tap_hint")).toBeOnTheScreen();
    expect(screen.getByText("search-outline")).toBeOnTheScreen();
    expect(screen.getByText("chevron-forward")).toBeOnTheScreen();
  });

  it("prompts to pick a country first when disabled", async () => {
    await render(<SpeciesDropdown query={baseQuery()} onPress={mockOnPress} value={null} disabled />);
    expect(screen.getByText("species_single")).toBeOnTheScreen();
    expect(screen.getByText("select_country_first")).toBeOnTheScreen();
    expect(screen.queryByText("chevron-forward")).not.toBeOnTheScreen();
  });

  it("does not fire onPress while disabled", async () => {
    await render(<SpeciesDropdown query={baseQuery()} onPress={mockOnPress} value={null} disabled />);
    expect(screen.getByTestId("species-dropdown-trigger").props.onPress).toBeUndefined();
  });
});

describe("error prop", () => {
  it("shows the field error text", async () => {
    await render(
      <SpeciesDropdown query={baseQuery()} onPress={mockOnPress} value={null} error="Required" />,
    );
    expect(screen.getByText("Required")).toBeOnTheScreen();
  });
});
