jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("@react-navigation/native", () => ({
  useRoute: () => mockRoute,
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
}));
jest.mock("../../util/fetches", () => ({
  fetchRatingCompareHeader: jest.fn(),
  fetchRatingCompare: jest.fn(),
}));
jest.mock("../../store/profile-context", () => ({
  useProfile: jest.fn(),
}));
jest.mock("../../hooks/useOpenSpecies", () => ({
  useOpenSpecies: () => mockOpenSpecies,
}));
jest.mock("../../components/ui/Tabs", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ tabOptions, tabsMode, setTabsMode }: {
      tabOptions: Array<{ value: string; count?: number }>;
      tabsMode: string;
      setTabsMode: (v: string) => void;
    }) => (
      <>
        <Text>{`tabsMode:${tabsMode}`}</Text>
        {tabOptions.map((opt) => (
          <TouchableOpacity key={opt.value} testID={`tab-${opt.value}`} onPress={() => setTabsMode(opt.value)}>
            <Text>{`${opt.value}:${opt.count ?? "none"}`}</Text>
          </TouchableOpacity>
        ))}
      </>
    ),
  };
});
jest.mock("../../components/Profile/CompareProfileHeader", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ myProfileId }: { myProfileId?: number }) => <Text>{`header:${myProfileId}`}</Text>,
  };
});
jest.mock("../../components/Rating/RatingCompareCard", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ item, onPress }: { item: { segment: string }; onPress: () => void }) => (
      <TouchableOpacity testID="compare-card" onPress={onPress}>
        <Text>{`card:${item.segment}`}</Text>
      </TouchableOpacity>
    ),
  };
});
const mockOpenSpecies = jest.fn();
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
import { useQuery } from "@tanstack/react-query";
import { fetchRatingCompareHeader } from "../../util/fetches";
import { useProfile } from "../../store/profile-context";
import { createRouteMock } from "../test-utils";
import RatingsCompareScreen from "../RatingsCompareScreen";

const mockRoute = createRouteMock("RatingsCompare", { profile1: 1, profile2: 2 });
const originalOS = Platform.OS;
const latestProps = () => mockListScreenCapture.mock.calls.at(-1)![0];

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
  (useQuery as jest.Mock).mockReturnValue({
    data: { profile_data: { id: 1 }, counts: { common: 3, all: 10, different: 7 } },
  });
  (useProfile as jest.Mock).mockReturnValue({ profile: { user: 1, private: false } });
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("queries the compare header keyed by both profiles and current filters, enabled only when both ids are present", async () => {
  await render(<RatingsCompareScreen />);
  const call = (useQuery as jest.Mock).mock.calls[0][0];
  expect(call.queryKey).toEqual(["ratingCompareHeader", 1, 2, null]);
  expect(call.enabled).toBe(true);

  (fetchRatingCompareHeader as jest.Mock).mockResolvedValueOnce({});
  await call.queryFn();
  expect(fetchRatingCompareHeader).toHaveBeenCalledWith(1, 2, null);
});

it("passes fetchRatingCompare, restricted filters, and extraFilters (profiles + active tab) to ListScreen", async () => {
  await render(<RatingsCompareScreen />);
  const props = latestProps();
  expect(props.title).toBe("comparison");
  expect(props.allowedFilters).toEqual(["territory", "date", "species"]);
  expect(props.showHeaderBadge).toBe(false);
  expect(props.extraFilters).toEqual({ profile1: 1, profile2: 2, tab: "all" });
  expect(props.getItemId({ taxon_id: 55 })).toBe(55);
});

it("renderItem opens species details on press", async () => {
  await render(<RatingsCompareScreen />);
  const { renderItem } = latestProps();
  await render(renderItem({ item: { segment: "bird-1" }, index: 0 }));
  await fireEvent.press(screen.getByTestId("compare-card"));
  expect(mockOpenSpecies).toHaveBeenCalledWith("bird-1", "rating_compare");
});

it("renders the compare header as listHeader with the current profile id and counts", async () => {
  await render(<RatingsCompareScreen />);
  await render(latestProps().listHeader);
  expect(screen.getByText("header:1")).toBeOnTheScreen();
});

it("switching tabs updates tabsMode and extraFilters.tab", async () => {
  await render(<RatingsCompareScreen />);
  await render(latestProps().bottomEl);

  await act(async () => {
    await fireEvent.press(screen.getByTestId("tab-common"));
  });

  expect(latestProps().extraFilters).toEqual({ profile1: 1, profile2: 2, tab: "common" });
});

describe("handleShare", () => {
  it("does nothing when there's no signed-in profile", async () => {
    (useProfile as jest.Mock).mockReturnValue({ profile: {} });
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    await render(<RatingsCompareScreen />);
    await latestProps().handleSharePress();
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it("shows a privacy toast instead of sharing when the profile is private and one of the compared profiles", async () => {
    (useProfile as jest.Mock).mockReturnValue({ profile: { user: 1, private: true } });
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    await render(<RatingsCompareScreen />);
    await latestProps().handleSharePress();

    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: "profile_private" }));
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it("shares a platform-appropriate compare url otherwise", async () => {
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    Platform.OS = "ios";
    await render(<RatingsCompareScreen />);
    await latestProps().handleSharePress();
    expect(shareSpy).toHaveBeenCalledWith({ url: expect.stringContaining("users/compare/1/2/") });
  });
});
