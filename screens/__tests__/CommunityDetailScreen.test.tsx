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
jest.mock("../../hooks/useModeration", () => ({
  useModeration: () => ({
    report: mockReport,
    block: mockBlock,
    unblock: jest.fn(),
    isPending: false,
  }),
}));
const mockShowMenu = jest.fn();
jest.mock("../../services/bottomSheet", () => ({
  BottomSheet: { showMenu: (payload: unknown) => mockShowMenu(payload), hide: jest.fn() },
}));
jest.mock("../../hooks/useOpenSpecies", () => ({
  useOpenSpecies: () => mockOpenSpecies,
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
const mockOpenSpecies = jest.fn();
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
const mockPhotosCapture = jest.fn();
jest.mock("../../components/Observation/ObservationPhotos", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockPhotosCapture(props);
      return <View testID="observation-photos" />;
    },
  };
});
jest.mock("../../components/ui/IconsHeader", () => {
  const { TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({
      headerRightEnd = [],
    }: {
      headerRightEnd?: Array<{ condition: boolean; onPress: () => void; testID?: string }>;
    }) => (
      <>
        {headerRightEnd
          .filter((btn) => btn.condition)
          .map((btn) => (
            <TouchableOpacity key={btn.testID} testID={btn.testID} onPress={btn.onPress}>
              <Text>{btn.testID}</Text>
            </TouchableOpacity>
          ))}
      </>
    ),
  };
});

import { Share, Platform } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useItem } from "../../hooks/useItem";
import { createNavigationMock, createRouteMock } from "../test-utils";
import CommunityDetailScreen from "../CommunityDetailScreen";

const mockNavigation = createNavigationMock();
const mockRoute = createRouteMock("ObservationDetail", { observationId: 1 });
const mockRefetch = jest.fn();
const mockReport = jest.fn();
const mockBlock = jest.fn();
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

// Everything the card can do now lives behind the header's "⋯".
const menuRow = async (label: string) => {
  await headerRight();
  await fireEvent.press(screen.getByTestId("overflow-button"));
  const { items } = mockShowMenu.mock.calls.at(-1)![0];
  const row = items.find((item: { label: string }) => item.label === label);
  if (!row) throw new Error(`no "${label}" row: ${items.map((i: { label: string }) => i.label)}`);
  return row as { onPress: () => void };
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
  expect(mockOpenSpecies).toHaveBeenCalledWith("blackbird", "community_observation");
});

// The segment is localized and rides on the same response as the name, so it
// goes missing on a record created offline and on a copy cached under another
// language. The header used to draw the "about" link anyway and answer the tap
// with nothing at all.
it("hides the species link when there is no segment to follow", async () => {
  mockItem({
    data: {
      ...OBSERVATION,
      species_data: { ...OBSERVATION.species_data, segment: "" },
    },
  });

  await render(<CommunityDetailScreen />);
  expect(screen.queryByText("about_species")).toBeNull();

  await fireEvent.press(screen.getByText("Blackbird"));
  expect(mockOpenSpecies).not.toHaveBeenCalled();
});

it("falls back to the latin name when no localized name is available", async () => {
  mockItem({ data: { ...OBSERVATION, species_data: { ...OBSERVATION.species_data, name_lang: "" } } });
  await render(<CommunityDetailScreen />);
  expect(screen.getAllByText("Turdus merula")).toHaveLength(2);
});

it("shares from the header menu once the observation loads", async () => {
  const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
  Platform.OS = "ios";
  await render(<CommunityDetailScreen />);
  (await menuRow("share")).onPress();
  expect(shareSpy).toHaveBeenCalledWith({ url: expect.stringContaining("my/community/1/") });

  shareSpy.mockClear();
  Platform.OS = "android";
  await render(<CommunityDetailScreen />);
  (await menuRow("share")).onPress();
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

describe("own record", () => {
  it("replaces itself with the own card instead of rendering a stranger's one", async () => {
    mockItem({ data: { ...OBSERVATION, is_owner: true } });
    await render(<CommunityDetailScreen />);

    // Reachable only through a shared link: the own observation's share button
    // builds a community URL, and the feed's retrieve serves own records too.
    expect(mockNavigation.replace).toHaveBeenCalledWith("ObservationDetail", {
      observationId: 1,
    });
    expect(screen.getByTestId("loading-overlay")).toBeOnTheScreen();
    expect(screen.queryByText("Blackbird")).not.toBeOnTheScreen();
  });

  it("leaves someone else's record on this screen", async () => {
    await render(<CommunityDetailScreen />);

    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(screen.getByText("Blackbird")).toBeOnTheScreen();
  });
});

describe("photos", () => {
  it("shows another user's photos, and nothing at all without them", async () => {
    await render(<CommunityDetailScreen />);
    expect(screen.queryByTestId("observation-photos")).not.toBeOnTheScreen();

    const photos = [{ id: 1, image: "a.jpg", thumbnail: "a-thumb.jpg" }];
    mockItem({ data: { ...OBSERVATION, photos } });
    await render(<CommunityDetailScreen />);

    expect(screen.getByTestId("observation-photos")).toBeOnTheScreen();
    expect(mockPhotosCapture).toHaveBeenCalledWith(
      expect.objectContaining({ photos }),
    );
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
// the "approximate area" label.
//
// Whether the name is visible is the server's call, not this screen's: someone
// else's place comes back with `name: null` (PlaceSimpleSerializer.get_name),
// a public eBird hotspot keeps its own. The screen renders what it got.
describe("place name", () => {
  const withheldPlace = { ...OBSERVATION.place_data, name: null };

  it("shows the approximate-area label when the server withheld the name", async () => {
    mockItem({
      data: {
        ...OBSERVATION, is_owner: false, location_private: true,
        place_data: withheldPlace,
      },
    });
    await render(<CommunityDetailScreen />);
    expect(screen.getByText("approximate_area")).toBeOnTheScreen();
    expect(screen.queryByText("City Park")).not.toBeOnTheScreen();
  });

  it("shows the name of a public eBird hotspot", async () => {
    mockItem({
      data: {
        ...OBSERVATION, is_owner: false, location_private: true,
        place_data: { ...OBSERVATION.place_data, name: "Naroch Lake" },
      },
    });
    await render(<CommunityDetailScreen />);
    expect(screen.getByText("Naroch Lake")).toBeOnTheScreen();
    expect(screen.queryByText("approximate_area")).not.toBeOnTheScreen();
  });

  it("shows location_not_specified for a private observation with no place", async () => {
    mockItem({
      data: { ...OBSERVATION, is_owner: false, location_private: true, place_data: null },
    });
    await render(<CommunityDetailScreen />);
    expect(screen.getByText("location_not_specified")).toBeOnTheScreen();
  });

  it("hides the place name entirely for a public location of another user's observation", async () => {
    mockItem({
      data: {
        ...OBSERVATION, is_owner: false, location_private: false,
        place_data: withheldPlace,
      },
    });
    await render(<CommunityDetailScreen />);
    expect(screen.queryByText("approximate_area")).not.toBeOnTheScreen();
    expect(screen.queryByText("City Park")).not.toBeOnTheScreen();
  });

  // The owner's own case is gone from this screen: such a record is replaced
  // with ObservationDetail (see "own record" above), which has the exact place
  // of its own.
});

describe("reporting", () => {
  it("reports the observation from the header menu and leaves the card", async () => {
    await render(<CommunityDetailScreen />);

    (await menuRow("report_observation")).onPress();

    expect(mockReport).toHaveBeenCalledWith(
      { observation: 1 },
      { onDone: expect.any(Function) },
    );
    // The server stops serving a record its reporter reported, so the screen
    // has to leave rather than sit on a card the next refetch turns into 404.
    mockReport.mock.calls.at(-1)![1].onDone();
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it("hands the photo strip a per-photo report", async () => {
    mockItem({
      data: {
        ...OBSERVATION,
        photos: [{ id: 42, image: "a.jpg", thumbnail: "a-thumb.jpg" }],
      },
    });
    await render(<CommunityDetailScreen />);

    const { onReport } = mockPhotosCapture.mock.calls.at(-1)![0];
    onReport({ id: 42 });

    // No onDone: only the photo goes, and the invalidated query drops it from
    // the strip without taking the card down.
    expect(mockReport).toHaveBeenCalledWith({ photo: 42 });
  });
});

describe("blocking the author", () => {
  it("is offered next to reporting, where the content is actually seen", async () => {
    await render(<CommunityDetailScreen />);

    (await menuRow("block_author")).onPress();

    expect(mockBlock).toHaveBeenCalledWith(9, { onDone: expect.any(Function) });
    // Their records leave the feed at once, so the card behind this one is
    // about to stop existing.
    mockBlock.mock.calls.at(-1)![1].onDone();
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it("is left out when the record has no author to block (an eBird import)", async () => {
    mockItem({ data: { ...OBSERVATION, owner: null } });
    await render(<CommunityDetailScreen />);

    await expect(menuRow("block_author")).rejects.toThrow();
  });
});
