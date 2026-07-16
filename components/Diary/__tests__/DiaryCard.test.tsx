jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      primary100: "#fff",
      shadow: "#000",
      imageBg: "#eee",
      textMain: "#000",
      textSecondary: "#666",
      error600: "#f00",
    },
  }),
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
    Image: (props: Record<string, unknown>) => <View testID="species-thumb" {...props} />,
  };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return {
    BirdSVG: (props: Record<string, unknown>) => <View testID="species-thumb-placeholder" {...props} />,
  };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import DiaryCard from "../DiaryCard";

const mockNavigation = createNavigationMock();

const DIARY = {
  id: 1,
  date_time: "2026-01-01T08:00:00Z",
  territory_data: { code: "FR", name: "France" },
  private: false,
  location_private: false,
  place: null,
  place_data: null,
  name: null,
  observation_data: [] as Array<{ species_data: { thumb: string | null } }>,
  observation_count: 0,
  _pendingSync: null as string | null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the index and formatted date", async () => {
  await render(<DiaryCard item={DIARY as never} index={2} />);
  expect(screen.getByText("3.")).toBeOnTheScreen();
});

it("navigates to DiaryDetail with the diary id and a seed item on press", async () => {
  await render(<DiaryCard item={DIARY as never} index={0} />);
  await fireEvent.press(screen.getByText("1."));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("DiaryDetail", { diaryId: 1, initialDiary: DIARY });
});

describe("sync status icon", () => {
  it("shows nothing when not pending", async () => {
    await render(<DiaryCard item={DIARY as never} index={0} />);
    expect(screen.queryByTestId("diary-sync-pending-icon")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("diary-sync-error-icon")).not.toBeOnTheScreen();
  });

  it("shows the pending-upload icon while syncing", async () => {
    await render(<DiaryCard item={{ ...DIARY, _pendingSync: "pending" } as never} index={0} />);
    expect(screen.getByTestId("diary-sync-pending-icon")).toBeOnTheScreen();
  });

  it("shows the error icon when sync failed", async () => {
    await render(<DiaryCard item={{ ...DIARY, _pendingSync: "error" } as never} index={0} />);
    expect(screen.getByTestId("diary-sync-error-icon")).toBeOnTheScreen();
  });
});

describe("privacy/location icon", () => {
  it("shows nothing for a public diary with no place", async () => {
    await render(<DiaryCard item={DIARY as never} index={0} />);
    expect(screen.queryByTestId("icon-lock-closed-outline")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("icon-eye-off-outline")).not.toBeOnTheScreen();
  });

  it("shows the lock icon for a private diary", async () => {
    await render(<DiaryCard item={{ ...DIARY, private: true } as never} index={0} />);
    expect(screen.getByTestId("icon-lock-closed-outline")).toBeOnTheScreen();
  });

  it("shows the eye-off icon for a public diary with a private location", async () => {
    await render(<DiaryCard item={{ ...DIARY, place: 2, location_private: true } as never} index={0} />);
    expect(screen.getByTestId("icon-eye-off-outline")).toBeOnTheScreen();
  });
});

it("shows the territory flag when territory_data is present, hides it otherwise", async () => {
  await render(<DiaryCard item={DIARY as never} index={0} />);
  expect(screen.getByText("🇫🇷")).toBeOnTheScreen();

  await render(<DiaryCard item={{ ...DIARY, territory_data: null } as never} index={0} />);
  expect(screen.queryByText("🇫🇷")).not.toBeOnTheScreen();
});

describe("species thumbnails row", () => {
  it("renders nothing when there are no observations yet", async () => {
    await render(<DiaryCard item={DIARY as never} index={0} />);
    expect(screen.queryByTestId("species-thumb")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("species-thumb-placeholder")).not.toBeOnTheScreen();
  });

  it("renders a real thumbnail or a placeholder per observation, matching its own thumb", async () => {
    const item = {
      ...DIARY,
      observation_data: [{ species_data: { thumb: "a.jpg" } }, { species_data: { thumb: null } }],
    };
    await render(<DiaryCard item={item as never} index={0} />);
    expect(screen.getAllByTestId("species-thumb")).toHaveLength(1);
    expect(screen.getAllByTestId("species-thumb-placeholder")).toHaveLength(1);
  });

  it("shows a '+N more' badge only once the count exceeds 5", async () => {
    const fiveObs = Array.from({ length: 5 }, () => ({ species_data: { thumb: null } }));
    await render(
      <DiaryCard item={{ ...DIARY, observation_data: fiveObs, observation_count: 5 } as never} index={0} />,
    );
    expect(screen.queryByText(/^\+/)).not.toBeOnTheScreen();

    await render(
      <DiaryCard item={{ ...DIARY, observation_data: fiveObs, observation_count: 8 } as never} index={0} />,
    );
    expect(screen.getByText("+3")).toBeOnTheScreen();
  });
});

describe("place row", () => {
  it("shows the place name when set", async () => {
    await render(<DiaryCard item={{ ...DIARY, place_data: { name: "City Park" } } as never} index={0} />);
    expect(screen.getByText("City Park")).toBeOnTheScreen();
  });

  it("shows nothing when there's no place name", async () => {
    await render(<DiaryCard item={DIARY as never} index={0} />);
    expect(screen.queryByTestId("icon-location-outline")).not.toBeOnTheScreen();
  });
});

describe("name row", () => {
  it("shows the diary name when set", async () => {
    await render(<DiaryCard item={{ ...DIARY, name: "Morning walk" } as never} index={0} />);
    expect(screen.getByText("Morning walk")).toBeOnTheScreen();
  });

  it("shows nothing when there's no name", async () => {
    await render(<DiaryCard item={DIARY as never} index={0} />);
    expect(screen.queryByTestId("icon-document-text-outline")).not.toBeOnTheScreen();
  });
});
