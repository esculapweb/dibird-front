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
}));
jest.mock("../../hooks/useItem", () => ({ useItem: jest.fn() }));
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
jest.mock("../../components/Profile/ProfileAvatar", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>avatar</Text> };
});
const mockMapCapture = jest.fn();
jest.mock("../../components/Map/MapL", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockMapCapture(props);
      return <Text>map</Text>;
    },
  };
});
jest.mock("../../components/ui/IconsHeader", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onSharePress }: { onSharePress?: () => void }) => (
      <>
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
import { useItem } from "../../hooks/useItem";
import { speciesDetails } from "../../util/helpers";
import { createNavigationMock, createRouteMock } from "../test-utils";
import CommunityDetailScreen from "../CommunityDetailScreen";

const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("ObservationDetail", { observationId: 1 });
const mockRefetch = jest.fn();
const originalOS = Platform.OS;

const OBSERVATION = {
  id: 1,
  species_data: { name: "Turdus merula", name_lang: "Blackbird", segment: "blackbird", thumb: null },
  date_time: "2026-01-01T08:00:00Z",
  territory: 5,
  territory_data: { code: "FR", name: "France" },
  place_data: { name: "City Park", location: null },
  owner: { id: 9, first_name: "Jane", last_name: "Doe", username: "jdoe", private: false },
  external_username: null,
  time: null,
  quantity: null,
};

const mockItem = (overrides: Record<string, unknown> = {}) => {
  (useItem as jest.Mock).mockReturnValue({
    data: OBSERVATION,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  });
};

const headerRight = async () => {
  const call = (mockNavigation.setOptions as jest.Mock).mock.calls.at(-1);
  await render(call![0].headerRight());
};

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = originalOS;
  mockItem();
});

afterEach(() => {
  Platform.OS = originalOS;
});

it("shows a loading overlay while there's no observation yet", async () => {
  mockItem({ data: undefined, isLoading: true });
  await render(<CommunityDetailScreen />);
  expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
  expect(mockNavigation.setOptions).not.toHaveBeenCalled();
});

it("shows an error overlay with retry when there's an error and no cached observation", async () => {
  mockItem({ data: undefined, isError: true, error: { message: "boom" } });
  await render(<CommunityDetailScreen />);

  expect(screen.getByText("observations_unavailable")).toBeOnTheScreen();
  await fireEvent.press(screen.getByText("try_again"));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});

it("keeps showing cached data despite isError, without an error overlay", async () => {
  mockItem({ isError: true, error: { message: "boom" } });
  await render(<CommunityDetailScreen />);
  expect(screen.queryByText("observations_unavailable")).not.toBeOnTheScreen();
  expect(screen.getByText("Blackbird")).toBeOnTheScreen();
});

it("renders the species name (preferring the localized name) and opens species details on tap", async () => {
  await render(<CommunityDetailScreen />);
  expect(screen.getByText("Blackbird")).toBeOnTheScreen();
  expect(screen.getByText("Turdus merula")).toBeOnTheScreen();

  await fireEvent.press(screen.getByText("Blackbird"));
  expect(speciesDetails).toHaveBeenCalledWith("blackbird");
});

it("falls back to the latin name when no localized name is available", async () => {
  mockItem({ data: { ...OBSERVATION, species_data: { ...OBSERVATION.species_data, name_lang: "" } } });
  await render(<CommunityDetailScreen />);
  expect(screen.getAllByText("Turdus merula")).toHaveLength(2);
});

it("wires up the share header button once the observation loads", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
  Platform.OS = "ios";
  await render(<CommunityDetailScreen />);
  await headerRight();
  await fireEvent.press(screen.getByTestId("share-button"));
  expect(shareSpy).toHaveBeenCalledWith({ url: expect.stringContaining("my/community/1/") });

  shareSpy.mockClear();
  Platform.OS = "android";
  await render(<CommunityDetailScreen />);
  await headerRight();
  await fireEvent.press(screen.getByTestId("share-button"));
  expect(shareSpy).toHaveBeenCalledWith({ message: expect.stringContaining("my/community/1/") });
});

it("'i saw this too' navigates to a pre-filled ObservationEditor", async () => {
  await render(<CommunityDetailScreen />);
  await fireEvent.press(screen.getByText("i_saw_this_too"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationEditor", {
    defaultTerritory: 5,
    defaultSpecies: undefined,
    returnMode: "back",
  });
});

describe("author row", () => {
  it("navigates to the author's stats unless their profile is private", async () => {
    await render(<CommunityDetailScreen />);
    await fireEvent.press(screen.getByText("observation_author"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("UserStat", { profileId: 9 });
  });

  it("does not navigate for a private author", async () => {
    mockItem({ data: { ...OBSERVATION, owner: { ...OBSERVATION.owner, private: true } } });
    await render(<CommunityDetailScreen />);
    await fireEvent.press(screen.getByText("observation_author"));
    expect(mockNavigation.navigate).not.toHaveBeenCalledWith("UserStat", expect.anything());
  });
});

describe("map", () => {
  it("does not render a map without place coordinates", async () => {
    await render(<CommunityDetailScreen />);
    expect(screen.queryByText("map")).not.toBeOnTheScreen();
  });

  it("renders a point map with the raw coordinates for non-Polygon locations", async () => {
    mockItem({
      data: {
        ...OBSERVATION,
        place_data: {
          ...OBSERVATION.place_data,
          location: { type: "Point", coordinates: [1, 2] },
        },
      },
    });
    await render(<CommunityDetailScreen />);
    expect(screen.getByText("map")).toBeOnTheScreen();
    expect(mockMapCapture).toHaveBeenCalledWith(
      expect.objectContaining({ currentCoords: [1, 2], currentZoom: 13, polygon: null }),
    );
  });

  it("renders a polygon map using its center and a wider zoom", async () => {
    const polygon = { type: "Polygon", center: [3, 4], coordinates: [[[0, 0]]] };
    mockItem({
      data: {
        ...OBSERVATION,
        place_data: { ...OBSERVATION.place_data, location: polygon },
      },
    });
    await render(<CommunityDetailScreen />);
    expect(mockMapCapture).toHaveBeenCalledWith(
      expect.objectContaining({ currentCoords: [3, 4], currentZoom: 10, polygon }),
    );
  });
});

// Regression: the place-name row was missing entirely from this screen, so a
// private observation of another user showed only the territory + map and never
// the "approximate area" label. Non-owners must never see the real place name.
describe("place name", () => {
  it("shows the approximate-area label (not the real place name) for a private location", async () => {
    mockItem({ data: { ...OBSERVATION, is_owner: false, location_private: true } });
    await render(<CommunityDetailScreen />);
    expect(screen.getByText("approximate_area")).toBeOnTheScreen();
    expect(screen.queryByText("City Park")).not.toBeOnTheScreen();
  });

  it("shows location_not_specified for a private observation with no place", async () => {
    mockItem({
      data: { ...OBSERVATION, is_owner: false, location_private: true, place_data: null },
    });
    await render(<CommunityDetailScreen />);
    expect(screen.getByText("location_not_specified")).toBeOnTheScreen();
  });

  it("hides the place name entirely for a public location of another user's observation", async () => {
    mockItem({ data: { ...OBSERVATION, is_owner: false, location_private: false } });
    await render(<CommunityDetailScreen />);
    expect(screen.queryByText("approximate_area")).not.toBeOnTheScreen();
    expect(screen.queryByText("City Park")).not.toBeOnTheScreen();
  });

  it("shows the real place name to the owner", async () => {
    mockItem({ data: { ...OBSERVATION, is_owner: true, location_private: true } });
    await render(<CommunityDetailScreen />);
    expect(screen.getByText("City Park")).toBeOnTheScreen();
    expect(screen.queryByText("approximate_area")).not.toBeOnTheScreen();
  });
});
