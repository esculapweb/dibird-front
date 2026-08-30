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
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
  useFocusEffect: (cb: () => void) => cb(),
}));
jest.mock("../../hooks/Diary/useOfflineDiary", () => ({
  useDiaryItem: jest.fn(),
  useUpdateDiary: jest.fn(),
  useDeleteDiary: jest.fn(),
  invalidateDiaryCaches: jest.fn(),
}));
jest.mock("../../hooks/repositories/diaryRepository", () => ({
  getFailedMutationFor: jest.fn(),
  retryMutation: jest.fn(),
  discardMutation: jest.fn(),
}));
jest.mock("../../services/sync/diarySync", () => ({
  runDiarySync: jest.fn(),
}));
jest.mock("../../util/fetches", () => ({
  fetchDiaryObservations: jest.fn(),
}));
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { show: jest.fn(), showMenu: jest.fn(), hide: jest.fn() },
}));
jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({ showErrorToast: mockShowErrorToast }),
}));
jest.mock("../../components/Place/PlacePreviewRow", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>place-preview</Text> };
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
jest.mock("../../components/Diary/DiaryObservationCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ owner }: { owner: boolean }) => <Text>{`obs-card:${owner}`}</Text>,
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

import { Share, Platform } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import {
  useDiaryItem,
  useUpdateDiary,
  useDeleteDiary,
  invalidateDiaryCaches,
} from "../../hooks/Diary/useOfflineDiary";
import * as diaryRepository from "../../hooks/repositories/diaryRepository";
import { runDiarySync } from "../../services/sync/diarySync";
import { BottomSheet } from "../../services/bottomSheet";
import {
  createNavigationMock,
  createRouteMock,
  openOverflow,
  overflowRow,
} from "../test-utils";
import DiaryDetailScreen from "../DiaryDetailScreen";

const mockShowErrorToast = jest.fn();
const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("DiaryDetail", { diaryId: 1 });
const mockRefetch = jest.fn();
const mockUpdateMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const originalOS = Platform.OS;
const latestProps = () => mockListScreenCapture.mock.calls.at(-1)![0];

const DIARY = {
  id: 1,
  name: "Morning walk",
  date_time: "2026-01-01T08:00:00Z",
  is_owner: true,
  private: false,
  location_private: false,
  territory: 5,
  territory_data: { code: "FR", name: "France" },
  place: 2,
  place_data: { name: "City Park" },
  owner: { id: 9, first_name: "Jane", last_name: "Doe", username: "jdoe", private: false },
  _syncError: null as string | null,
};

const mockDiaryItem = (overrides: Record<string, unknown> = {}) => {
  (useDiaryItem as jest.Mock).mockReturnValue({
    data: DIARY,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
};

const headerButton = async (testID: string) => {
  const props = latestProps();
  const btn = props.headerRightBeginning.find((b: { testID: string }) => b.testID === testID);
  return btn;
};

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
  mockDiaryItem();
  (useUpdateDiary as jest.Mock).mockReturnValue({ mutate: mockUpdateMutate, isPending: false });
  (useDeleteDiary as jest.Mock).mockReturnValue({ mutate: mockDeleteMutate, isPending: false });
  (diaryRepository.getFailedMutationFor as jest.Mock).mockReturnValue(null);
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("retries the diary sync queue on focus", async () => {
  await render(<DiaryDetailScreen />);
  expect(runDiarySync).toHaveBeenCalledTimes(1);
});

it("shows a loading overlay while there's no diary yet", async () => {
  mockDiaryItem({ data: undefined, isLoading: true });
  await render(<DiaryDetailScreen />);
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
});

it("shows an error overlay with retry when there's an error and no cached diary", async () => {
  mockDiaryItem({ data: undefined, isError: true, error: { message: "boom" } });
  await render(<DiaryDetailScreen />);

  expect(screen.getByText("diaries_unavailable")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("try_again"));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it("graduates a temp id to the real one once the offline create resolves", async () => {
  mockDiaryItem({ data: { ...DIARY, id: 555 } });
  await render(<DiaryDetailScreen />);
  expect(mockNavigation.setParams).toHaveBeenCalledWith({ diaryId: 555 });
});

it("passes fetchDiaryObservations, extraFilters (diary + territory), and title through to ListScreen", async () => {
  await render(<DiaryDetailScreen />);
  const props = latestProps();
  expect(props.extraFilters).toEqual({ diary: 1, territory: 5 });
  expect(props.allowedFilters).toEqual(["species"]);
  expect(props.title).toBe("diary");
});

it("renderItem forwards diary.is_owner to DiaryObservationCard", async () => {
  await render(<DiaryDetailScreen />);
  await render(latestProps().renderItem({ item: {}, index: 0 }));
  expect(screen.getByText("obs-card:true")).toBeOnTheScreen();
});

describe("owner-only actions", () => {
  it("onAdd navigates to ObservationEditor scoped to this diary, only for the owner", async () => {
    await render(<DiaryDetailScreen />);
    await latestProps().onAdd();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
      diaryId: 1,
      territoryValue: 5,
      diaryLocationPrivate: false,
      returnMode: "back",
    });

    mockDiaryItem({ data: { ...DIARY, is_owner: false } });
    await render(<DiaryDetailScreen />);
    expect(latestProps().onAdd).toBeUndefined();
  });

  it("edit header button is only present (and enabled) for the owner", async () => {
    await render(<DiaryDetailScreen />);
    const editBtn = await headerButton("diary-edit-button");
    expect(editBtn.condition).toBe(true);
    editBtn.onPress();
    expect(mockNavigation.navigate).toHaveBeenCalledWith("DiaryEditor", {
      diary: expect.objectContaining({ id: 1 }),
    });

    mockDiaryItem({ data: { ...DIARY, is_owner: false } });
    await render(<DiaryDetailScreen />);
    expect((await headerButton("diary-edit-button")).condition).toBeFalsy();
  });

  it("offers deleting to the owner only", async () => {
    await render(<DiaryDetailScreen />);
    expect(
      overflowRow(
        openOverflow(latestProps().headerRightEnd, BottomSheet.showMenu as jest.Mock),
        "delete_diary",
      ),
    ).toBeTruthy();

    mockDiaryItem({ data: { ...DIARY, is_owner: false } });
    await render(<DiaryDetailScreen />);
    expect(() =>
      overflowRow(
        openOverflow(latestProps().headerRightEnd, BottomSheet.showMenu as jest.Mock),
        "delete_diary",
      ),
    ).toThrow();
  });
});

describe("delete", () => {
  it("shows a danger confirm sheet, deleting and going back on confirm", async () => {
    await render(<DiaryDetailScreen />);
    overflowRow(
      openOverflow(latestProps().headerRightEnd, BottomSheet.showMenu as jest.Mock),
      "delete_diary",
    ).onPress();

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
  it("shows a privacy toast instead of sharing a private diary", async () => {
    mockDiaryItem({ data: { ...DIARY, private: true } });
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    await render(<DiaryDetailScreen />);
    overflowRow(
      openOverflow(latestProps().headerRightEnd, (BottomSheet.showMenu as jest.Mock)),
      "share",
    ).onPress();

    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: "diary_private" }));
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it("shares a platform-appropriate url for a public diary", async () => {
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    Platform.OS = "ios";
    await render(<DiaryDetailScreen />);
    overflowRow(
      openOverflow(latestProps().headerRightEnd, (BottomSheet.showMenu as jest.Mock)),
      "share",
    ).onPress();
    expect(shareSpy).toHaveBeenCalledWith({ url: expect.stringContaining("my/diary/1/") });
  });
});

describe("listHeader", () => {
  it("shows FailedEditBanner only with a sync error and a matching failed mutation", async () => {
    await render(<DiaryDetailScreen />);
    await render(latestProps().listHeader());
    expect(screen.queryByText("try_again")).not.toBeOnTheScreen();

    (diaryRepository.getFailedMutationFor as jest.Mock).mockReturnValue({ id: 9 });
    mockDiaryItem({ data: { ...DIARY, _syncError: "Network error" } });
    await render(<DiaryDetailScreen />);
    await render(latestProps().listHeader());
    expect(screen.getByText("Network error")).toBeOnTheScreen();
  });

  // The Diaries list has to be refreshed too, not just this diary — see the
  // matching pair of tests in ObservationDetailScreen.test.tsx for the bug
  // this locks down.
  describe("acting on that failed edit", () => {
    const withFailedMutation = async () => {
      (diaryRepository.getFailedMutationFor as jest.Mock).mockReturnValue({ id: 9 });
      mockDiaryItem({ data: { ...DIARY, _syncError: "Network error" } });
      await render(<DiaryDetailScreen />);
      await render(latestProps().listHeader());
    };

    it("refreshes the lists after a discard", async () => {
      await withFailedMutation();

      await fireEvent.press(screen.getByText("discard_changes"));

      expect(diaryRepository.discardMutation).toHaveBeenCalledWith(9, 1);
      expect(invalidateDiaryCaches).toHaveBeenCalledTimes(1);
    });

    it("refreshes the lists after a retry", async () => {
      await withFailedMutation();

      await fireEvent.press(screen.getByText("try_again"));

      expect(diaryRepository.retryMutation).toHaveBeenCalledWith(9, 1);
      expect(invalidateDiaryCaches).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the owner's own place preview when is_owner is true", async () => {
    await render(<DiaryDetailScreen />);
    await render(latestProps().listHeader());
    expect(screen.getByText("place-preview")).toBeOnTheScreen();
  });

  it("shows the author row (not place preview) for a non-owner, navigating to their stats unless private", async () => {
    mockDiaryItem({ data: { ...DIARY, is_owner: false } });
    await render(<DiaryDetailScreen />);
    await render(latestProps().listHeader());

    expect(screen.queryByText("place-preview")).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByText("diary_author"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("UserStat", { profileId: 9 });
  });

  it("does not navigate to a private author's stats", async () => {
    mockDiaryItem({
      data: { ...DIARY, is_owner: false, owner: { ...DIARY.owner, private: true } },
    });
    await render(<DiaryDetailScreen />);
    await render(latestProps().listHeader());

    await fireEvent.press(screen.getByText("diary_author"));
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith("UserStat", expect.anything());
  });

  // Regression: a non-owner viewing a private-location diary must see the
  // "approximate area" label, never the real place name; a public location
  // shows no place name at all. (The owner sees the place preview instead.)
  //
  // The public case is a deliberate rule, not an oversight, and this test is
  // what guards it: the place name belongs to the owner alone, and publishing
  // a location does not hand it over — the map below stays the only thing a
  // visitor gets. Do not "fix" it into showing place_data.name.
  describe("place name (non-owner)", () => {
    // The server withholds someone else's place name outright
    // (PlaceSimpleSerializer.get_name), so that is what the fixture carries.
    const renderHeader = async (data: Record<string, unknown>) => {
      mockDiaryItem({
        data: {
          ...DIARY, is_owner: false,
          place_data: { ...DIARY.place_data, name: null },
          ...data,
        },
      });
      await render(<DiaryDetailScreen />);
      await render(latestProps().listHeader());
    };

    it("shows the approximate-area label (not the real place name) for a private location", async () => {
      await renderHeader({ location_private: true });
      expect(screen.getByText("approximate_area")).toBeOnTheScreen();
      expect(screen.queryByText("City Park")).not.toBeOnTheScreen();
    });

    it("shows location_not_specified for a private diary with no place", async () => {
      await renderHeader({ location_private: true, place: null, place_data: null });
      expect(screen.getByText("location_not_specified")).toBeOnTheScreen();
    });

    it("hides the place name entirely for a public location", async () => {
      await renderHeader({ location_private: false });
      expect(screen.queryByText("approximate_area")).not.toBeOnTheScreen();
      expect(screen.queryByText("City Park")).not.toBeOnTheScreen();
    });
  });
});
