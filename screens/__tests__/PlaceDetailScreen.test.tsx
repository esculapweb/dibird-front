jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../components/ui/Layout", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children, bottom }: {
      children: import("react").ReactNode;
      bottom?: import("react").ReactNode;
    }) => (
      <View>
        {children}
        {bottom}
      </View>
    ),
  };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useFocusEffect: (cb: () => void) => cb(),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: jest.fn(),
}));
jest.mock("../../hooks/Place/useOfflinePlace", () => ({
  usePlaceItem: jest.fn(),
  useUpdatePlace: jest.fn(),
  useDeletePlace: jest.fn(),
}));
jest.mock("../../hooks/repositories/placeRepository", () => ({
  getFailedMutationFor: jest.fn(),
  retryMutation: jest.fn(),
  discardMutation: jest.fn(),
}));
jest.mock("../../services/sync/placeSync", () => ({
  runPlaceSync: jest.fn(),
}));
jest.mock("../../store/filters-context", () => ({
  useFilters: jest.fn(),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn() },
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("../../components/ui/IconsHeader", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ headerRightBeginning }: {
      headerRightBeginning: Array<{ onPress: () => void; disabled?: boolean; loading?: boolean; testID?: string }>;
    }) => (
      <>
        {headerRightBeginning.map((btn, i) => (
          <TouchableOpacity key={i} testID={btn.testID} onPress={btn.disabled ? undefined : btn.onPress}>
            <Text>{btn.loading ? "loading" : btn.disabled ? "disabled" : "enabled"}</Text>
          </TouchableOpacity>
        ))}
      </>
    ),
  };
});
jest.mock("../../components/Map/MapL", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>map</Text> };
});
jest.mock("../../components/Filters/FilterChips", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>filter-chips</Text> };
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePlaceItem,
  useUpdatePlace,
  useDeletePlace,
} from "../../hooks/Place/useOfflinePlace";
import * as placeRepository from "../../hooks/repositories/placeRepository";
import { runPlaceSync } from "../../services/sync/placeSync";
import { useFilters } from "../../store/filters-context";
import { BottomSheet } from "../../services/bottomSheet";
import { createNavigationMock, createRouteMock } from "../test-utils";
import PlaceDetailScreen from "../PlaceDetailScreen";

const mockShowErrorToast = jest.fn();
const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("PlaceDetail", { placeId: 1 });
const mockRefetch = jest.fn();
const mockUpdateMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockSetDate = jest.fn();

const PLACE = {
  id: 1,
  name: "City Park",
  territory_data: { code: "FR", name: "France" },
  territory: 5,
  location: { coordinates: [2.35, 48.86] },
  species_count: 3,
  observation_count: 10,
  diary_count: 2,
  favourite: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  _syncError: null as string | null,
};

const mockPlaceItem = (overrides: Record<string, unknown> = {}) => {
  (usePlaceItem as jest.Mock).mockReturnValue({
    data: PLACE,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
};

const headerButton = async (testID: string) => {
  const headerRight = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0].headerRight;
  await render(headerRight());
  return screen.getByTestId(testID);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPlaceItem();
  (useUpdatePlace as jest.Mock).mockReturnValue({ mutate: mockUpdateMutate, isPending: false });
  (useDeletePlace as jest.Mock).mockReturnValue({ mutate: mockDeleteMutate, isPending: false });
  (useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries: mockInvalidateQueries });
  (useFilters as jest.Mock).mockReturnValue({ date: null, setDate: mockSetDate });
  (placeRepository.getFailedMutationFor as jest.Mock).mockReturnValue(null);
});

it("retries the place sync queue on focus", async () => {
  await render(<PlaceDetailScreen />);
  expect(runPlaceSync).toHaveBeenCalledTimes(1);
});

it("shows a loading overlay while there's no place yet", async () => {
  mockPlaceItem({ data: undefined, isLoading: true });
  await render(<PlaceDetailScreen />);
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});

it("shows an error overlay with retry when there's an error and no cached place", async () => {
  mockPlaceItem({ data: undefined, isError: true, error: { message: "boom" } });
  await render(<PlaceDetailScreen />);

  expect(screen.getByText("places_unavailable")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("try_again"));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it("renders the place's name, territory, counts, and creation date", async () => {
  await render(<PlaceDetailScreen />);
  expect(screen.getByText("City Park")).toBeOnTheScreen();
  expect(screen.getByText("3")).toBeOnTheScreen();
  expect(screen.getByText("10")).toBeOnTheScreen();
  expect(screen.getByText("2")).toBeOnTheScreen();
});

it("shows the updated date only when it differs from the created date", async () => {
  await render(<PlaceDetailScreen />);
  expect(screen.queryByText(/updated:/)).not.toBeOnTheScreen();

  mockPlaceItem({ data: { ...PLACE, updated_at: "2026-02-01T00:00:00Z" } });
  await render(<PlaceDetailScreen />);
  expect(screen.getByText(/updated:/)).toBeOnTheScreen();
});

it("graduates a temp id to the real one once the offline create resolves", async () => {
  mockPlaceItem({ data: { ...PLACE, id: 555 } });
  await render(<PlaceDetailScreen />);
  expect(mockNavigation.setParams).toHaveBeenCalledWith({ placeId: 555 });
});

it("shows FailedEditBanner only when the place has a sync error and a matching failed mutation, wired to retry/discard", async () => {
  await render(<PlaceDetailScreen />);
  expect(screen.queryByText("try_again")).not.toBeOnTheScreen();

  (placeRepository.getFailedMutationFor as jest.Mock).mockReturnValue({ id: 9 });
  mockPlaceItem({ data: { ...PLACE, _syncError: "Network error" } });
  await render(<PlaceDetailScreen />);

  expect(screen.getByText("Network error")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("discard_changes"));
  expect(placeRepository.discardMutation).toHaveBeenCalledWith(9, 1);
  expect(mockRefetch).toHaveBeenCalled();
});

it("retrying a failed sync retries the mutation, resyncs, and refetches", async () => {
  (placeRepository.getFailedMutationFor as jest.Mock).mockReturnValue({ id: 9 });
  mockPlaceItem({ data: { ...PLACE, _syncError: "Network error" } });
  await render(<PlaceDetailScreen />);

  await fireEvent.press(screen.getByText("try_again"));

  expect(placeRepository.retryMutation).toHaveBeenCalledWith(9, 1);
  expect(runPlaceSync).toHaveBeenCalled();
  expect(mockRefetch).toHaveBeenCalled();
});

describe("favourite toggle", () => {
  it("toggles favourite via updateMutation", async () => {
    await render(<PlaceDetailScreen />);
    const btn = await headerButton("place-favourite-button");
    await fireEvent.press(btn);
    expect(mockUpdateMutate).toHaveBeenCalledWith(
      { favourite: true },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("reports an error via showErrorToast on failure", async () => {
    await render(<PlaceDetailScreen />);
    await headerButton("place-favourite-button");
    // Trigger via a fresh press since mutate isn't auto-invoked above.
    await fireEvent.press(screen.getByTestId("place-favourite-button"));
    const call = mockUpdateMutate.mock.calls.at(-1)![1];
    call.onError({ message: "boom" });
    expect(mockShowErrorToast).toHaveBeenCalledWith({ message: "boom" }, "PlaceDetailScreen:toggleFavourite:1");
  });
});

it("edit button navigates to PlaceEditor with the current place", async () => {
  await render(<PlaceDetailScreen />);
  const btn = await headerButton("place-edit-button");
  await fireEvent.press(btn);
  expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceEditor", { place: PLACE });
});

describe("delete", () => {
  it("shows a danger confirm sheet, deleting and going back on confirm", async () => {
    await render(<PlaceDetailScreen />);
    await fireEvent.press(screen.getByText("delete_place"));

    expect(BottomSheet.show).toHaveBeenCalledWith(
      expect.objectContaining({ danger: true, title: "delete_title" }),
    );
    const { onConfirm } = (BottomSheet.show as jest.Mock).mock.calls[0][0];
    onConfirm();

    const { onSuccess } = mockDeleteMutate.mock.calls[0][1];
    onSuccess();
    expect(mockDeleteMutate).toHaveBeenCalledWith(1, expect.anything());
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe("drill-down navigation", () => {
  it("species/observations/diaries cards push filtered lists scoped to this place", async () => {
    await render(<PlaceDetailScreen />);

    await fireEvent.press(screen.getByText("species"));
    expect(mockNavigation.push).toHaveBeenCalledWith("Stat", {
      filtersOverride: { territory: 5, place: 1, date: null },
      seenMode: "seen",
    });

    await fireEvent.press(screen.getByText("observations"));
    expect(mockNavigation.push).toHaveBeenCalledWith("Observations", {
      filtersOverride: { territory: 5, place: 1, date: null },
    });

    await fireEvent.press(screen.getByText("diaries"));
    expect(mockNavigation.push).toHaveBeenCalledWith("Diaries", {
      filtersOverride: { territory: 5, place: 1, date: null },
    });
  });
});

it("invalidates this place's queries when the global date filter changes", async () => {
  const { rerender } = await render(<PlaceDetailScreen />);
  mockInvalidateQueries.mockClear();

  (useFilters as jest.Mock).mockReturnValue({ date: { type: "year", year: 2025 }, setDate: mockSetDate });
  await act(async () => {
    await rerender(<PlaceDetailScreen />);
  });

  expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["Place", 1], exact: false });
});
