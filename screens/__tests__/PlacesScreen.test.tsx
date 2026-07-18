jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../util/fetches", () => ({
  fetchPlaces: jest.fn(),
}));
jest.mock("../../store/location-context", () => ({
  useLocation: jest.fn(),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn() },
}));
jest.mock("../../components/Place/PlaceCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, index }: { item: { id: number }; index: number }) => (
      <Text>{`place-card-${item.id}-${index}`}</Text>
    ),
  };
});
const mockListScreenCapture = jest.fn();
jest.mock("../ListScreen", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockListScreenCapture(props);
    return null;
  },
}));

import { render } from "@testing-library/react-native";
import { fetchPlaces } from "../../util/fetches";
import { useLocation } from "../../store/location-context";
import { createNavigationMock, createRouteMock } from "../test-utils";
import PlacesScreen from "../PlacesScreen";

const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("Places", {});

beforeEach(() => {
  jest.clearAllMocks();
  (useLocation as jest.Mock).mockReturnValue({
    locationCoords: { lat: 1, lon: 2 },
    locationAvailable: true,
  });
});

it("passes fetchPlaces, restricted filters, search, and location props through to ListScreen", async () => {
  await render(<PlacesScreen />);

  const props = mockListScreenCapture.mock.calls[0][0];
  expect(props.fetchFunction).toBe(fetchPlaces);
  expect(props.title).toBe("places");
  expect(props.errorTitle).toBe("places_unavailable");
  expect(props.allowedFilters).toEqual([
    "territory",
    "date",
    "favourite",
    "unsynced",
  ]);
  expect(props.showSearch).toBe(true);
  expect(props.locationCoords).toEqual({ lat: 1, lon: 2 });
  expect(props.locationAvailable).toBe(true);
  expect(typeof props.onLocationUnavailable).toBe("function");
});

it("renders a PlaceCard for each item via renderItem", async () => {
  await render(<PlacesScreen />);
  const { renderItem } = mockListScreenCapture.mock.calls[0][0];
  const { getByText } = await render(renderItem({ item: { id: 4 }, index: 1 }));
  expect(getByText("place-card-4-1")).toBeOnTheScreen();
});

it("handleAdd navigates to PlaceEditor with no params, wired the same way for onAdd and noItems' action", async () => {
  await render(<PlacesScreen />);
  const { onAdd, noItems } = mockListScreenCapture.mock.calls[0][0];

  onAdd();

  expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceEditor");
  expect(noItems.actions[0].onPress).toBe(onAdd);
});
