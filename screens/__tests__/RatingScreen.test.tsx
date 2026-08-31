const mockShowMenu = jest.fn();
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: {
    showMenu: (payload: unknown) => mockShowMenu(payload),
    showContent: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
  },
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => require("../mockTheme").mockUseTheme(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Ionicons: View };
});
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock("../../util/fetches", () => ({
  fetchRating: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("../../store/filters-context", () => ({
  useFilters: jest.fn(),
}));
jest.mock("../../store/profile-context", () => ({
  useProfile: jest.fn(),
}));
jest.mock("../../components/Rating/RatingCard", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, isSelected }: { item: { profile_id: number }; isSelected: boolean }) => (
      <Text>{`rating-card-${item.profile_id}-${isSelected}`}</Text>
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

import { Share, Platform } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { fetchRating } from "../../util/fetches";
import { useFilters } from "../../store/filters-context";
import { useProfile } from "../../store/profile-context";
import {
  createNavigationMock,
  createRouteMock,
  openOverflow,
  overflowRow,
} from "../test-utils";
import RatingScreen from "../RatingScreen";

const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("Rating", {});
const originalOS = Platform.OS;

const latestProps = () => mockListScreenCapture.mock.calls.at(-1)![0];

const toggle = async (profileId: number) => {
  const { renderItem } = latestProps();
  const element = renderItem({ item: { profile_id: profileId }, index: 0 });
  await act(async () => {
    element.props.onToggle();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
  (useFilters as jest.Mock).mockReturnValue({ territory: 5 });
  (useProfile as jest.Mock).mockReturnValue({ profile: { user: 1 } });
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("passes fetchRating and getItemId through to ListScreen", async () => {
  await render(<RatingScreen />);
  const props = latestProps();
  expect(props.fetchFunction).toBe(fetchRating);
  expect(props.title).toBe("rating");
  expect(props.getItemId({ profile_id: 42 })).toBe(42);
  // No fabIcon: ListScreen draws the FAB only for `onAdd`, which this screen
  // does not pass — comparing happens through the button at the bottom.
  expect(props.fabIcon).toBeUndefined();
});

it("renderItem wires isSelected/onToggle/profile from RatingScreen's own state", async () => {
  await render(<RatingScreen />);
  const { renderItem } = latestProps();
  const element = renderItem({ item: { profile_id: 1 }, index: 0 });
  expect(element.props.isSelected).toBe(false);
  expect(element.props.profile).toEqual({ user: 1 });
});

describe("selection", () => {
  it("selects up to two profiles, toggling isSelected", async () => {
    await render(<RatingScreen />);
    await toggle(1);
    expect(latestProps().renderItem({ item: { profile_id: 1 }, index: 0 }).props.isSelected).toBe(true);

    await toggle(1);
    expect(latestProps().renderItem({ item: { profile_id: 1 }, index: 0 }).props.isSelected).toBe(false);
  });

  it("shows a limit toast instead of selecting a third profile", async () => {
    await render(<RatingScreen />);
    await toggle(1);
    await toggle(2);
    (Toast.show as jest.Mock).mockClear();

    await toggle(3);

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: "selection_limit" }),
    );
    expect(latestProps().renderItem({ item: { profile_id: 3 }, index: 0 }).props.isSelected).toBe(false);
  });
});

describe("bottomEl", () => {
  it("prompts to select two profiles when fewer than two are selected", async () => {
    await render(<RatingScreen />);
    await render(latestProps().bottomEl);
    expect(screen.getByText("select_two_for_comparison")).toBeOnTheScreen();
  });

  it("shows the compare button once exactly two are selected, navigating with both ids", async () => {
    await render(<RatingScreen />);
    await toggle(1);
    await toggle(2);

    await render(latestProps().bottomEl);
    await fireEvent.press(screen.getByText("compare_ratings"));

    expect(mockNavigation.navigate).toHaveBeenCalledWith("RatingsCompare", {
      profile1: 1,
      profile2: 2,
    });
  });
});

it("handleShare shares a platform-appropriate payload", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);

  Platform.OS = "ios";
  await render(<RatingScreen />);
  overflowRow(
    openOverflow(latestProps().headerRightEnd, mockShowMenu),
    "share",
  ).onPress();
  expect(shareSpy).toHaveBeenLastCalledWith({ url: expect.any(String) });

  Platform.OS = "android";
  await render(<RatingScreen />);
  overflowRow(
    openOverflow(latestProps().headerRightEnd, mockShowMenu),
    "share",
  ).onPress();
  expect(shareSpy).toHaveBeenLastCalledWith({ message: expect.any(String) });
});
