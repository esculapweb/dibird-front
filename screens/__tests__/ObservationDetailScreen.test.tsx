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
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return { Image: View };
});
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
jest.mock("../../hooks/Observation/useOfflineObservation", () => ({
  useObservationItem: jest.fn(),
  useUpdateObservation: jest.fn(),
  useDeleteObservation: jest.fn(),
  invalidateObservationCaches: jest.fn(),
}));
jest.mock("../../hooks/repositories/observationRepository", () => ({
  getFailedMutationFor: jest.fn(),
  retryMutation: jest.fn(),
  discardMutation: jest.fn(),
}));
jest.mock("../../services/sync/observationSync", () => ({
  runObservationSync: jest.fn(),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn() },
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
// speciesDetails is a Linking.openURL side effect (stubbed); buildShareUrl/
// isoToFlagEmoji/formatDate* are real, pure, already unit-tested elsewhere.
jest.mock("../../util/helpers", () => ({
  ...jest.requireActual("../../util/helpers"),
  speciesDetails: jest.fn(),
}));
jest.mock("../../components/ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: View };
});
jest.mock("../../components/ui/Section", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ children }: { children: import("react").ReactNode }) => <View>{children}</View>,
  };
});
jest.mock("../../components/ui/PrivacyToggle", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>privacy-toggle</Text> };
});
jest.mock("../../components/Profile/ProfileAvatar", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>avatar</Text> };
});
jest.mock("../../components/Map/MapL", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>map</Text> };
});
jest.mock("../../components/ui/IconsHeader", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ headerRightBeginning, onSharePress }: {
      headerRightBeginning: Array<{ onPress: () => void; disabled?: boolean; condition?: unknown; testID?: string }>;
      onSharePress?: () => void;
    }) => (
      <>
        {headerRightBeginning.filter((btn) => btn.condition).map((btn, i) => (
          <TouchableOpacity key={i} testID={btn.testID} onPress={btn.disabled ? undefined : btn.onPress}>
            <Text>{btn.disabled ? "disabled" : "enabled"}</Text>
          </TouchableOpacity>
        ))}
        {onSharePress && (
          <TouchableOpacity testID="share-button" onPress={onSharePress}>
            <Text>share</Text>
          </TouchableOpacity>
        )}
      </>
    ),
  };
});

import { Share, Platform } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import {
  useObservationItem,
  useUpdateObservation,
  useDeleteObservation,
  invalidateObservationCaches,
} from "../../hooks/Observation/useOfflineObservation";
import * as observationRepository from "../../hooks/repositories/observationRepository";
import { runObservationSync } from "../../services/sync/observationSync";
import { BottomSheet } from "../../services/bottomSheet";
import { speciesDetails } from "../../util/helpers";
import { createNavigationMock, createRouteMock } from "../test-utils";
import ObservationDetailScreen from "../ObservationDetailScreen";

const mockShowErrorToast = jest.fn();
const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("ObservationDetail", { observationId: 1 });
const mockRefetch = jest.fn();
const mockUpdateMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const originalOS = Platform.OS;

const OBSERVATION = {
  id: 1,
  species_data: { name: "Turdus merula", name_lang: "Blackbird", segment: "blackbird", thumb: null },
  date_time: "2026-01-01T08:00:00Z",
  created_at: "2026-01-01T08:00:00Z",
  updated_at: "2026-01-01T08:00:00Z",
  is_owner: true,
  private: false,
  location_private: false,
  territory: 5,
  territory_data: { code: "FR", name: "France" },
  place: 2,
  place_data: { id: 2, name: "City Park" },
  owner: { id: 9, first_name: "Jane", last_name: "Doe", username: "jdoe", private: false },
  notes: null,
  diary: null,
  diary_data: null,
  quantity: null,
  time: null,
  _syncError: null as string | null,
};

const mockItem = (overrides: Record<string, unknown> = {}) => {
  (useObservationItem as jest.Mock).mockReturnValue({
    data: OBSERVATION,
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
  Platform.OS = originalOS;
  mockItem();
  (useUpdateObservation as jest.Mock).mockReturnValue({ mutate: mockUpdateMutate, isPending: false });
  (useDeleteObservation as jest.Mock).mockReturnValue({ mutate: mockDeleteMutate, isPending: false });
  (observationRepository.getFailedMutationFor as jest.Mock).mockReturnValue(null);
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("retries the observation sync queue on focus", async () => {
  await render(<ObservationDetailScreen />);
  expect(runObservationSync).toHaveBeenCalledTimes(1);
});

it("shows a loading overlay while there's no observation yet", async () => {
  mockItem({ data: undefined, isLoading: true });
  await render(<ObservationDetailScreen />);
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});

it("shows an error overlay with retry when there's an error and no cached observation", async () => {
  mockItem({ data: undefined, isError: true, error: { message: "boom" } });
  await render(<ObservationDetailScreen />);

  expect(screen.getByText("observations_unavailable")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("try_again"));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it("graduates a temp id to the real one once the offline create resolves", async () => {
  mockItem({ data: { ...OBSERVATION, id: 555 } });
  await render(<ObservationDetailScreen />);
  expect(mockNavigation.setParams).toHaveBeenCalledWith({ observationId: 555 });
});

it("renders the species name (preferring the localized name) and opens species details on tap", async () => {
  await render(<ObservationDetailScreen />);
  expect(screen.getByText("Blackbird")).toBeOnTheScreen();
  expect(screen.getByText("Turdus merula")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("Blackbird"));
  expect(speciesDetails).toHaveBeenCalledWith("blackbird");
});

it("shows FailedEditBanner only with a sync error and a matching failed mutation, wired to retry/discard", async () => {
  await render(<ObservationDetailScreen />);
  expect(screen.queryByText("discard_changes")).not.toBeOnTheScreen();

  (observationRepository.getFailedMutationFor as jest.Mock).mockReturnValue({ id: 9 });
  mockItem({ data: { ...OBSERVATION, _syncError: "Network error" } });
  await render(<ObservationDetailScreen />);

  expect(screen.getByText("Network error")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("discard_changes"));
  expect(observationRepository.discardMutation).toHaveBeenCalledWith(9, 1);
});

// Dropping or retrying a stuck mutation changes the lists too, so both have
// to invalidate the shared caches — refetch() alone reloads only this screen,
// and the discarded record used to stay in the Observations list (with its
// warning badge) right through a relaunch, because that list result is
// persisted. See .maestro/offline-orphaned-observation-fails.yaml.
describe("a failed edit acted on from the banner", () => {
  const withFailedMutation = async () => {
    (observationRepository.getFailedMutationFor as jest.Mock).mockReturnValue({ id: 9 });
    mockItem({ data: { ...OBSERVATION, _syncError: "Network error" } });
    await render(<ObservationDetailScreen />);
  };

  it("refreshes the lists after a discard, not just this screen", async () => {
    await withFailedMutation();

    await fireEvent.press(screen.getByText("discard_changes"));

    expect(invalidateObservationCaches).toHaveBeenCalledTimes(1);
  });

  it("refreshes the lists after a retry as well", async () => {
    await withFailedMutation();

    await fireEvent.press(screen.getByText("try_again"));

    expect(observationRepository.retryMutation).toHaveBeenCalledWith(9, 1);
    expect(invalidateObservationCaches).toHaveBeenCalledTimes(1);
  });
});

describe("owner-only header actions", () => {
  it("edit button navigates to ObservationEditor with the observation, adding diary context when diary-scoped", async () => {
    await render(<ObservationDetailScreen />);
    const btn = await headerButton("observation-edit-button");
    await fireEvent.press(btn);
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      "ObservationEditor",
      expect.objectContaining({ observation: expect.objectContaining({ id: 1 }) }),
    );

    (mockNavigation.navigate as jest.Mock).mockClear();
    mockItem({ data: { ...OBSERVATION, diary: 7 } });
    await render(<ObservationDetailScreen />);
    const diaryBtn = await headerButton("observation-edit-button");
    await fireEvent.press(diaryBtn);
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      "ObservationEditor",
      expect.objectContaining({ diaryId: 7, territoryValue: 5 }),
    );
  });

  it("edit button does not render at all for a non-owner", async () => {
    mockItem({ data: { ...OBSERVATION, is_owner: false } });
    await render(<ObservationDetailScreen />);
    const headerRight = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1)![0].headerRight;
    await render(headerRight());
    expect(screen.queryByTestId("observation-edit-button")).not.toBeOnTheScreen();
  });

  it("bottomEl (delete button) only renders for the owner", async () => {
    await render(<ObservationDetailScreen />);
    expect(screen.getByText("delete_observation")).toBeOnTheScreen();

    mockItem({ data: { ...OBSERVATION, is_owner: false } });
    await render(<ObservationDetailScreen />);
    expect(screen.queryByText("delete_observation")).not.toBeOnTheScreen();
  });
});

describe("delete", () => {
  it("shows a danger confirm sheet, deleting and going back on confirm", async () => {
    await render(<ObservationDetailScreen />);
    await fireEvent.press(screen.getByText("delete_observation"));

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

describe("handleShare", () => {
  it("shows a privacy toast instead of sharing a private observation", async () => {
    mockItem({ data: { ...OBSERVATION, private: true } });
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    await render(<ObservationDetailScreen />);
    await headerButton("observation-edit-button");
    await fireEvent.press(screen.getByTestId("share-button"));

    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: "observation_private" }));
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it("shares a platform-appropriate url for a public observation", async () => {
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    Platform.OS = "android";
    await render(<ObservationDetailScreen />);
    await headerButton("observation-edit-button");
    await fireEvent.press(screen.getByTestId("share-button"));
    expect(shareSpy).toHaveBeenCalledWith({ message: expect.stringContaining("my/community/1/") });
  });
});

describe("author / place rows for a non-owner", () => {
  it("navigates to the author's stats unless their profile is private", async () => {
    mockItem({ data: { ...OBSERVATION, is_owner: false } });
    await render(<ObservationDetailScreen />);

    await fireEvent.press(screen.getByText("observation_author"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("UserStat", { profileId: 9 });
  });

  it("does not navigate for a private author", async () => {
    mockItem({
      data: { ...OBSERVATION, is_owner: false, owner: { ...OBSERVATION.owner, private: true } },
    });
    await render(<ObservationDetailScreen />);

    await fireEvent.press(screen.getByText("observation_author"));
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith("UserStat", expect.anything());
  });
});

it("owner tapping the place row navigates to PlaceDetail", async () => {
  await render(<ObservationDetailScreen />);
  await fireEvent.press(screen.getByText("City Park"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceDetail", { placeId: 2 });
});

// Regression: a non-owner viewing a private-location observation must see the
// "approximate area" label, never the real place name; a public location shows
// no place name at all (only the territory + exact map).
describe("place name", () => {
  it("shows the approximate-area label (not the real place name) for a non-owner's private location", async () => {
    mockItem({ data: { ...OBSERVATION, is_owner: false, location_private: true } });
    await render(<ObservationDetailScreen />);
    expect(screen.getByText("approximate_area")).toBeOnTheScreen();
    expect(screen.queryByText("City Park")).not.toBeOnTheScreen();
  });

  it("shows location_not_specified for a non-owner's private observation with no place", async () => {
    mockItem({
      data: { ...OBSERVATION, is_owner: false, location_private: true, place: null, place_data: null },
    });
    await render(<ObservationDetailScreen />);
    expect(screen.getByText("location_not_specified")).toBeOnTheScreen();
  });

  it("hides the place name entirely for a non-owner's public location", async () => {
    mockItem({ data: { ...OBSERVATION, is_owner: false, location_private: false } });
    await render(<ObservationDetailScreen />);
    expect(screen.queryByText("approximate_area")).not.toBeOnTheScreen();
    expect(screen.queryByText("City Park")).not.toBeOnTheScreen();
  });

  it("shows the real place name to the owner", async () => {
    mockItem({ data: { ...OBSERVATION, is_owner: true, location_private: true } });
    await render(<ObservationDetailScreen />);
    expect(screen.getByText("City Park")).toBeOnTheScreen();
    expect(screen.queryByText("approximate_area")).not.toBeOnTheScreen();
  });
});

it("owner tapping the diary block navigates to DiaryDetail", async () => {
  mockItem({ data: { ...OBSERVATION, diary: 7, diary_data: { name: "Morning walk" } } });
  await render(<ObservationDetailScreen />);
  await fireEvent.press(screen.getByText("Morning walk"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("DiaryDetail", { diaryId: 7 });
});

it("shows the updated date only when it differs from the created date", async () => {
  await render(<ObservationDetailScreen />);
  expect(screen.queryByText(/updated:/)).not.toBeOnTheScreen();

  mockItem({ data: { ...OBSERVATION, updated_at: "2026-02-01T08:00:00Z" } });
  await render(<ObservationDetailScreen />);
  expect(screen.getByText(/updated:/)).toBeOnTheScreen();
});
