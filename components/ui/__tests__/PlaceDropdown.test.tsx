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
      <View testID="place-image" accessibilityValue={{ text: source.uri }} />
    ),
  };
});
jest.mock("../../../util/fetches", () => ({ fetchMapPreview: jest.fn() }));
jest.mock("../../../services/errors", () => ({ logError: jest.fn() }));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { fetchMapPreview } from "../../../util/fetches";
import { logError } from "../../../services/errors";
import { createNavigationMock } from "../../../screens/test-utils";
import PlaceDropdown from "../PlaceDropdown";
import { PlaceDropdownItem, QueryType } from "../../../types";

const mockOnPress = jest.fn();
const mockOnClear = jest.fn();
const mockRefetch = jest.fn();
const mockNavigation = createNavigationMock();

const baseQuery = (overrides: Partial<QueryType> = {}): QueryType => ({
  data: [],
  isLoading: false,
  isError: false,
  refetch: mockRefetch,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (fetchMapPreview as jest.Mock).mockResolvedValue({ preview: "place/9/preview.jpg" });
});

describe("loading", () => {
  it("shows a spinner/loading text, and still fires onPress on tap", async () => {
    await render(
      <PlaceDropdown
        query={baseQuery({ isLoading: true })}
        onPress={mockOnPress}
        value={null}
        placeData={null}
        disabled={false}
      />,
    );
    expect(screen.getByText("loading_")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("place-dropdown-trigger"));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
    expect(mockRefetch).not.toHaveBeenCalled();
  });
});

describe("error", () => {
  it("shows a retry icon/error text, and refetches instead of calling onPress", async () => {
    await render(
      <PlaceDropdown
        query={baseQuery({ isError: true })}
        onPress={mockOnPress}
        value={null}
        placeData={null}
        disabled={false}
      />,
    );
    expect(screen.getByText("failed_to_load_data")).toBeOnTheScreen();
    expect(screen.getByText("refresh")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("place-dropdown-trigger"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockOnPress).not.toHaveBeenCalled();
  });
});

describe("selected with an existing preview (placeData.preview set)", () => {
  const placeData: PlaceDropdownItem = { value: 9, label: "My Garden", name: "My Garden", preview: "place/9/preview.jpg" };

  it("shows the preview image immediately without calling fetchMapPreview", async () => {
    await render(
      <PlaceDropdown query={baseQuery()} onPress={mockOnPress} value={9} placeData={placeData} disabled={false} />,
    );
    expect(screen.getByTestId("place-image").props.accessibilityValue.text).toBe(
      "https://test.local/media/place/9/preview.jpg",
    );
    expect(fetchMapPreview).not.toHaveBeenCalled();
    expect(screen.getByText("My Garden")).toBeOnTheScreen();
    expect(screen.getByText("tap_to_change")).toBeOnTheScreen();
  });

  it("navigates to PlaceDetail when the expand overlay is pressed", async () => {
    await render(
      <PlaceDropdown query={baseQuery()} onPress={mockOnPress} value={9} placeData={placeData} disabled={false} />,
    );
    await fireEvent.press(screen.getByText("expand-outline"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceDetail", { placeId: 9 });
  });
});

describe("selected without a cached preview — fetches it", () => {
  const placeData: PlaceDropdownItem = { value: 9, label: "My Garden", name: "My Garden" };

  it("fetches and shows the preview, clearing previewLoading afterwards", async () => {
    await render(
      <PlaceDropdown query={baseQuery()} onPress={mockOnPress} value={9} placeData={placeData} disabled={false} />,
    );
    expect(fetchMapPreview).toHaveBeenCalledWith(9);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("place-image").props.accessibilityValue.text).toBe(
      "https://test.local/media/place/9/preview.jpg",
    );
  });

  it("logs the error and leaves the preview empty when the fetch fails", async () => {
    (fetchMapPreview as jest.Mock).mockRejectedValue(new Error("boom"));
    await render(
      <PlaceDropdown query={baseQuery()} onPress={mockOnPress} value={9} placeData={placeData} disabled={false} />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(logError).toHaveBeenCalledWith(expect.any(Error), "PlaceDropdown:mapPreview:9");
    expect(screen.queryByTestId("place-image")).not.toBeOnTheScreen();
  });
});

describe("empty (nothing selected)", () => {
  it("prompts to select a place when enabled", async () => {
    await render(
      <PlaceDropdown query={baseQuery()} onPress={mockOnPress} value={null} placeData={null} disabled={false} />,
    );
    expect(screen.getByText("select_place")).toBeOnTheScreen();
    expect(screen.getByText("place_tap_hint")).toBeOnTheScreen();
    expect(screen.getByText("chevron-forward")).toBeOnTheScreen();
  });

  it("prompts to pick a country first when disabled, and hides the chevron", async () => {
    await render(
      <PlaceDropdown query={baseQuery()} onPress={mockOnPress} value={null} placeData={null} disabled />,
    );
    expect(screen.getByText("place")).toBeOnTheScreen();
    expect(screen.getByText("select_country_first")).toBeOnTheScreen();
    expect(screen.queryByText("chevron-forward")).not.toBeOnTheScreen();
  });
});

describe("onClear", () => {
  const placeData: PlaceDropdownItem = { value: 9, label: "My Garden", name: "My Garden", preview: "p.jpg" };

  it("shows a clear button when a value + onClear are given, and calls onClear on tap", async () => {
    await render(
      <PlaceDropdown
        query={baseQuery()}
        onPress={mockOnPress}
        value={9}
        placeData={placeData}
        disabled={false}
        onClear={mockOnClear}
      />,
    );
    await fireEvent.press(screen.getByText("close-circle"));
    expect(mockOnClear).toHaveBeenCalledTimes(1);
  });

  it("hides the clear button without an onClear handler", async () => {
    await render(
      <PlaceDropdown query={baseQuery()} onPress={mockOnPress} value={9} placeData={placeData} disabled={false} />,
    );
    expect(screen.queryByText("close-circle")).not.toBeOnTheScreen();
  });
});

describe("error prop", () => {
  it("shows the field error text", async () => {
    await render(
      <PlaceDropdown
        query={baseQuery()}
        onPress={mockOnPress}
        value={null}
        placeData={null}
        disabled={false}
        error="Required"
      />,
    );
    expect(screen.getByText("Required")).toBeOnTheScreen();
  });
});
