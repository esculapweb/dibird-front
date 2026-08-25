jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useFocusEffect: (cb: () => void) => cb(),
}));
jest.mock("../../util/fetches", () => ({
  fetchObservations: jest.fn(),
}));
jest.mock("../../services/sync/observationSync", () => ({
  runObservationSync: jest.fn(),
}));
jest.mock("../../store/filters-context", () => ({
  useFilters: jest.fn(),
}));
jest.mock("../../components/Observation/ObservationCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, index }: { item: { id: number }; index: number }) => (
      <Text>{`observation-card-${item.id}-${index}`}</Text>
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

import { act, render } from "@testing-library/react-native";
import { fetchObservations } from "../../util/fetches";
import { runObservationSync } from "../../services/sync/observationSync";
import { useFilters } from "../../store/filters-context";
import { createNavigationMock, createRouteMock } from "../test-utils";
import ObservationsScreen from "../ObservationsScreen";

const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("Observations", {});

beforeEach(() => {
  jest.clearAllMocks();
  (useFilters as jest.Mock).mockReturnValue({ territory: 5 });
});

it("passes fetchObservations and titles/errors through to ListScreen", async () => {
  await render(<ObservationsScreen />);

  const props = mockListScreenCapture.mock.calls[0][0];
  expect(props.fetchFunction).toBe(fetchObservations);
  expect(props.allowedFilters).toContain("private");
  expect(props.title).toBe("observations");
  expect(props.errorTitle).toBe("observations_unavailable");
});

it("retries the observation sync queue on focus", async () => {
  await render(<ObservationsScreen />);
  expect(runObservationSync).toHaveBeenCalledTimes(1);
});

it("renders an ObservationCard for each item via renderItem", async () => {
  await render(<ObservationsScreen />);
  const { renderItem } = mockListScreenCapture.mock.calls[0][0];
  const { getByText } = await render(renderItem({ item: { id: 7 }, index: 2 }));
  expect(getByText("observation-card-7-2")).toBeOnTheScreen();
});

describe("handleAdd defaults", () => {
  it("falls back to the global territory filter when no list filter is active yet", async () => {
    await render(<ObservationsScreen />);
    const { onAdd } = mockListScreenCapture.mock.calls[0][0];
    await onAdd();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
      defaultTerritory: 5,
      defaultPlace: null,
      defaultSpecies: null,
    });
  });

  it("prefers the list's own active territory/place/species filters once set", async () => {
    await render(<ObservationsScreen />);
    const { onFiltersChange } = mockListScreenCapture.mock.calls[0][0];
    await act(async () => {
      await onFiltersChange({ territory: 9, place: 3, species: 11 });
    });
    const propsAfter = mockListScreenCapture.mock.calls.at(-1)[0];
    await propsAfter.onAdd();
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith("ObservationEditor", {
      defaultTerritory: 9,
      defaultPlace: 3,
      defaultSpecies: 11,
    });
  });

  it("noItems' first action triggers the same handleAdd", async () => {
    await render(<ObservationsScreen />);
    const { noItems, onAdd } = mockListScreenCapture.mock.calls[0][0];
    expect(noItems.actions[0].onPress).toBe(onAdd);
  });
});
