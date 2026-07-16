jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      primary100: "#fff",
      shadow: "#000",
      textMain: "#000",
      textSecondary: "#666",
      main100: "#0a0",
      yellow: "#ff0",
      error600: "#f00",
      badgeBg: "#eee",
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
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return { BirdSVG: View };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import PlaceCard from "../PlaceCard";

const mockNavigation = createNavigationMock();

const PLACE = {
  id: 1,
  name: "City Park",
  favourite: false,
  territory_data: { code: "FR", name: "France" },
  location: { coordinates: [2.123456, 48.987654] },
  distance: null as number | null,
  observation_count: 5,
  species_count: 3,
  _pendingSync: null as string | null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the index, name, and rounded coordinates", async () => {
  await render(<PlaceCard item={PLACE as never} index={2} />);
  expect(screen.getByText("3.")).toBeOnTheScreen();
  expect(screen.getByText("City Park")).toBeOnTheScreen();
  expect(screen.getByText("48.9877, 2.1235")).toBeOnTheScreen();
});

it("navigates to PlaceDetail with the place id and a seed item on press", async () => {
  await render(<PlaceCard item={PLACE as never} index={0} />);
  await fireEvent.press(screen.getByText("City Park"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("PlaceDetail", { placeId: 1, initialPlace: PLACE });
});

it("shows the favourite star only when the place is a favourite", async () => {
  await render(<PlaceCard item={PLACE as never} index={0} />);
  expect(screen.queryByTestId("icon-star")).not.toBeOnTheScreen();

  await render(<PlaceCard item={{ ...PLACE, favourite: true } as never} index={0} />);
  expect(screen.getByTestId("icon-star")).toBeOnTheScreen();
});

describe("sync status icon", () => {
  it("shows nothing when not pending", async () => {
    await render(<PlaceCard item={PLACE as never} index={0} />);
    expect(screen.queryByTestId("place-sync-pending-icon")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("place-sync-error-icon")).not.toBeOnTheScreen();
  });

  it("shows the pending-upload icon while syncing", async () => {
    await render(<PlaceCard item={{ ...PLACE, _pendingSync: "pending" } as never} index={0} />);
    expect(screen.getByTestId("place-sync-pending-icon")).toBeOnTheScreen();
  });

  it("shows the error icon when sync failed", async () => {
    await render(<PlaceCard item={{ ...PLACE, _pendingSync: "error" } as never} index={0} />);
    expect(screen.getByTestId("place-sync-error-icon")).toBeOnTheScreen();
  });
});

it("shows the territory flag when territory_data is present, hides it otherwise", async () => {
  await render(<PlaceCard item={PLACE as never} index={0} />);
  expect(screen.getByText("🇫🇷")).toBeOnTheScreen();

  await render(<PlaceCard item={{ ...PLACE, territory_data: null } as never} index={0} />);
  expect(screen.queryByText("🇫🇷")).not.toBeOnTheScreen();
});

describe("distance", () => {
  it("shows nothing when distance is null", async () => {
    await render(<PlaceCard item={PLACE as never} index={0} />);
    expect(screen.queryByText(/~/)).not.toBeOnTheScreen();
  });

  it("shows meters for a short distance", async () => {
    await render(<PlaceCard item={{ ...PLACE, distance: 250 } as never} index={0} />);
    expect(screen.getByText("~250 m")).toBeOnTheScreen();
  });

  it("shows kilometers for a long distance", async () => {
    await render(<PlaceCard item={{ ...PLACE, distance: 1500 } as never} index={0} />);
    expect(screen.getByText("~1.5 km")).toBeOnTheScreen();
  });
});

it("shows observation and species counts", async () => {
  await render(<PlaceCard item={PLACE as never} index={0} />);
  expect(screen.getByText("5")).toBeOnTheScreen();
  expect(screen.getByText("3")).toBeOnTheScreen();
});
