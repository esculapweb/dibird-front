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
      <View testID="place-preview-image" accessibilityValue={{ text: source.uri }} />
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
import PlacePreviewRow from "../PlacePreviewRow";
import { PlaceData, TerritoryData } from "../../../types";

const mockNavigation = createNavigationMock();

const TERRITORY: TerritoryData = { id: 1, code: "fr", name: "France", segment: "france" };

beforeEach(() => {
  jest.clearAllMocks();
  (fetchMapPreview as jest.Mock).mockResolvedValue({ preview: "place/9/preview.jpg" });
});

describe("no place selected", () => {
  it("shows a not-specified prompt and a plain location icon, disabled", async () => {
    await render(<PlacePreviewRow placeData={null as never} territoryData={TERRITORY} />);
    expect(screen.getByText("location_not_specified")).toBeOnTheScreen();
    expect(screen.getByText("location-outline")).toBeOnTheScreen();
    expect(screen.queryByText("chevron-forward")).not.toBeOnTheScreen();
  });

  it("does not navigate when pressed", async () => {
    await render(<PlacePreviewRow placeData={null as never} territoryData={TERRITORY} />);
    await fireEvent.press(screen.getByText("location_not_specified"));
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});

describe("territory line", () => {
  it("shows the flag emoji and territory name", async () => {
    await render(
      <PlacePreviewRow placeData={{ id: 9, name: "My Garden", preview: null, location: null }} territoryData={TERRITORY} />,
    );
    expect(screen.getByText("🇫🇷 France", { exact: false })).toBeOnTheScreen();
  });
});

describe("preview with an existing image (placeData.preview set)", () => {
  const placeData: PlaceData = { id: 9, name: "My Garden", preview: "place/9/preview.jpg", location: null };

  it("shows the preview image immediately without calling fetchMapPreview", async () => {
    await render(<PlacePreviewRow placeData={placeData} territoryData={TERRITORY} />);
    expect(screen.getByTestId("place-preview-image").props.accessibilityValue.text).toBe(
      "https://test.local/media/place/9/preview.jpg",
    );
    expect(fetchMapPreview).not.toHaveBeenCalled();
    expect(screen.getByText("My Garden")).toBeOnTheScreen();
    expect(screen.getByText("chevron-forward")).toBeOnTheScreen();
  });

  it("navigates to PlaceDetail when pressed", async () => {
    await render(<PlacePreviewRow placeData={placeData} territoryData={TERRITORY} />);
    await fireEvent.press(screen.getByText("My Garden"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceDetail", { placeId: 9 });
  });
});

describe("preview without a cached image — fetches it", () => {
  const placeData: PlaceData = { id: 9, name: "My Garden", preview: null, location: null };

  it("fetches and shows the preview", async () => {
    await render(<PlacePreviewRow placeData={placeData} territoryData={TERRITORY} />);
    expect(fetchMapPreview).toHaveBeenCalledWith(9);

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("place-preview-image").props.accessibilityValue.text).toBe(
      "https://test.local/media/place/9/preview.jpg",
    );
  });

  it("logs the error and leaves the preview empty when the fetch fails", async () => {
    (fetchMapPreview as jest.Mock).mockRejectedValue(new Error("boom"));
    await render(<PlacePreviewRow placeData={placeData} territoryData={TERRITORY} />);

    await act(async () => {
      await Promise.resolve();
    });
    expect(logError).toHaveBeenCalledWith(expect.any(Error), "PlacePreviewRow:mapPreview:9");
    expect(screen.queryByTestId("place-preview-image")).not.toBeOnTheScreen();
  });
});
