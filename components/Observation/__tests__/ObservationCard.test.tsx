jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      primary100: "#fff",
      shadow: "#000",
      imageBg: "#eee",
      textMain: "#000",
      textSecondary: "#666",
      statIcon: "#999",
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
    Image: (props: Record<string, unknown>) => <View testID="observation-thumb" {...props} />,
  };
});
jest.mock("../../ui/Svgs", () => {
  const { View } = require("react-native");
  return {
    BirdSVG: (props: Record<string, unknown>) => <View testID="observation-thumb-placeholder" {...props} />,
  };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import ObservationCard from "../ObservationCard";

const mockNavigation = createNavigationMock();

const OBSERVATION = {
  id: 1,
  species_data: { name: "Turdus merula", name_lang: "Blackbird", segment: "blackbird", thumb: null },
  date_time: "2026-01-01T08:00:00Z",
  territory_data: { code: "FR", name: "France" },
  private: false,
  location_private: false,
  place: null,
  place_data: null,
  notes: null,
  diary: null,
  quantity: null,
  time: null,
  _pendingSync: null as string | null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the species names, index and formatted date", async () => {
  await render(<ObservationCard item={OBSERVATION as never} index={2} />);
  expect(screen.getByText("Blackbird")).toBeOnTheScreen();
  expect(screen.getByText("Turdus merula")).toBeOnTheScreen();
  expect(screen.getByText("3.")).toBeOnTheScreen();
});

it("navigates to ObservationDetail with the observation id and a seed item on press", async () => {
  await render(<ObservationCard item={OBSERVATION as never} index={0} />);
  await fireEvent.press(screen.getByText("Blackbird"));

  expect(mockNavigation.navigate).toHaveBeenCalledWith("ObservationDetail", {
    observationId: 1,
    initialObservation: OBSERVATION,
  });
});

it("badges a threatened species on its photo, and leaves the rest alone", async () => {
  await render(
    <ObservationCard
      item={{
        ...OBSERVATION,
        species_data: { ...OBSERVATION.species_data, status: "EN" },
      } as never}
      index={0}
    />,
  );
  expect(screen.getByText("EN")).toBeOnTheScreen();

  await render(
    <ObservationCard
      item={{
        ...OBSERVATION,
        species_data: { ...OBSERVATION.species_data, status: "LC" },
      } as never}
      index={0}
    />,
  );
  expect(screen.queryByText("LC")).toBeNull();
});

describe("thumbnail", () => {
  it("shows the bird placeholder icon when there's no thumb", async () => {
    await render(<ObservationCard item={OBSERVATION as never} index={0} />);
    expect(screen.getByTestId("observation-thumb-placeholder")).toBeOnTheScreen();
    expect(screen.queryByTestId("observation-thumb")).not.toBeOnTheScreen();
  });

  it("shows the real image when a thumb is available", async () => {
    await render(
      <ObservationCard
        item={{ ...OBSERVATION, species_data: { ...OBSERVATION.species_data, thumb: "t.jpg" } } as never}
        index={0}
      />,
    );
    expect(screen.getByTestId("observation-thumb")).toBeOnTheScreen();
    expect(screen.queryByTestId("observation-thumb-placeholder")).not.toBeOnTheScreen();
  });
});

describe("sync status icon", () => {
  it("shows nothing when not pending", async () => {
    await render(<ObservationCard item={OBSERVATION as never} index={0} />);
    expect(screen.queryByTestId("observation-sync-pending-icon")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("observation-sync-error-icon")).not.toBeOnTheScreen();
  });

  it("shows the pending-upload icon while syncing", async () => {
    await render(<ObservationCard item={{ ...OBSERVATION, _pendingSync: "pending" } as never} index={0} />);
    expect(screen.getByTestId("observation-sync-pending-icon")).toBeOnTheScreen();
  });

  it("shows the error icon when sync failed", async () => {
    await render(<ObservationCard item={{ ...OBSERVATION, _pendingSync: "error" } as never} index={0} />);
    expect(screen.getByTestId("observation-sync-error-icon")).toBeOnTheScreen();
  });
});

describe("privacy/location icon", () => {
  it("shows nothing for a public observation with no place", async () => {
    await render(<ObservationCard item={OBSERVATION as never} index={0} />);
    expect(screen.queryByTestId("icon-lock-closed-outline")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("icon-eye-off-outline")).not.toBeOnTheScreen();
    expect(screen.queryByTestId("icon-location-outline")).not.toBeOnTheScreen();
  });

  it("shows the lock icon for a private observation", async () => {
    await render(<ObservationCard item={{ ...OBSERVATION, private: true } as never} index={0} />);
    expect(screen.getByTestId("icon-lock-closed-outline")).toBeOnTheScreen();
  });

  it("shows the eye-off icon for a public observation with a private location", async () => {
    await render(
      <ObservationCard item={{ ...OBSERVATION, place: 2, location_private: true } as never} index={0} />,
    );
    expect(screen.getByTestId("icon-eye-off-outline")).toBeOnTheScreen();
  });

  it("shows the plain location icon for a public observation with a public location", async () => {
    await render(
      <ObservationCard item={{ ...OBSERVATION, place: 2, location_private: false } as never} index={0} />,
    );
    // Two legitimately render together here: the privacy-status icon (place
    // set, not private) and the place row's own icon — both "location-outline".
    expect(screen.getAllByTestId("icon-location-outline")).toHaveLength(2);
  });
});

it("shows the territory flag when territory_data is present", async () => {
  await render(<ObservationCard item={OBSERVATION as never} index={0} />);
  expect(screen.getByText("🇫🇷")).toBeOnTheScreen();

  await render(<ObservationCard item={{ ...OBSERVATION, territory_data: null } as never} index={0} />);
  expect(screen.queryByText("🇫🇷")).not.toBeOnTheScreen();
});

it("shows the time only when present, formatted", async () => {
  await render(<ObservationCard item={OBSERVATION as never} index={0} />);
  expect(screen.queryByTestId("icon-time-outline")).not.toBeOnTheScreen();

  await render(<ObservationCard item={{ ...OBSERVATION, time: "9:5:00" } as never} index={0} />);
  expect(screen.getByText("09:05")).toBeOnTheScreen();
});

it("shows the quantity badge only when quantity is set", async () => {
  await render(<ObservationCard item={OBSERVATION as never} index={0} />);
  expect(screen.queryByTestId("icon-time-outline")).not.toBeOnTheScreen();

  await render(<ObservationCard item={{ ...OBSERVATION, quantity: 4 } as never} index={0} />);
  expect(screen.getByText("4")).toBeOnTheScreen();
});

describe("place row", () => {
  it("shows the place name and icon when a place is set", async () => {
    await render(
      <ObservationCard item={{ ...OBSERVATION, place: 2, place_data: { name: "City Park" } } as never} index={0} />,
    );
    expect(screen.getByText("City Park")).toBeOnTheScreen();
  });

  it("shows nothing in the place slot without a place", async () => {
    await render(<ObservationCard item={OBSERVATION as never} index={0} />);
    expect(screen.queryByTestId("icon-location-outline")).not.toBeOnTheScreen();
  });

  it("shows a notes icon only when notes are present", async () => {
    await render(<ObservationCard item={{ ...OBSERVATION, notes: "some notes" } as never} index={0} />);
    expect(screen.getByTestId("icon-document-text-outline")).toBeOnTheScreen();
  });

  it("shows a diary icon only when scoped to a diary", async () => {
    await render(<ObservationCard item={{ ...OBSERVATION, diary: 7 } as never} index={0} />);
    expect(screen.getByTestId("icon-book-outline")).toBeOnTheScreen();
  });
});
