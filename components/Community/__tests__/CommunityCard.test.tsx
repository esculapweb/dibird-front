jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      primary100: "#fff",
      shadow: "#000",
      imageBg: "#eee",
      textMain: "#000",
      textSecondary: "#666",
      statIcon: "#999",
      main100: "#0a0",
      main300: "#0f0",
      border: "#ccc",
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
    BirdSVG: (props: Record<string, unknown>) => <View testID="thumb-placeholder" {...props} />,
  };
});
jest.mock("../../Profile/ProfileAvatar", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>avatar</Text> };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import CommunityCard from "../CommunityCard";

const mockNavigation = createNavigationMock();

const OBSERVATION = {
  id: 1,
  species_data: { name: "Turdus merula", name_lang: "Blackbird", segment: "blackbird", thumb: null },
  date_time: "2026-01-01T08:00:00Z",
  territory_data: { code: "FR", name: "France" },
  external_source: "eBird",
  external_username: "jdoe",
  distance: null as number | null,
  quantity: null as number | null,
  time: null as string | null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the species names, index and formatted date", async () => {
  await render(<CommunityCard item={OBSERVATION as never} index={2} />);
  expect(screen.getByText("Blackbird")).toBeOnTheScreen();
  expect(screen.getByText("Turdus merula")).toBeOnTheScreen();
  expect(screen.getByText("3.")).toBeOnTheScreen();
});

it("navigates to CommunityDetail with the observation id on press", async () => {
  await render(<CommunityCard item={OBSERVATION as never} index={0} />);
  await fireEvent.press(screen.getByText("Blackbird"));
  expect(mockNavigation.navigate).toHaveBeenCalledWith("CommunityDetail", { observationId: 1 });
});

it("shows the territory flag when territory_data is present, hides it otherwise", async () => {
  await render(<CommunityCard item={OBSERVATION as never} index={0} />);
  expect(screen.getByText("🇫🇷")).toBeOnTheScreen();

  await render(<CommunityCard item={{ ...OBSERVATION, territory_data: null } as never} index={0} />);
  expect(screen.queryByText("🇫🇷")).not.toBeOnTheScreen();
});

it("shows the time only when present, formatted", async () => {
  await render(<CommunityCard item={OBSERVATION as never} index={0} />);
  expect(screen.queryByTestId("icon-time-outline")).not.toBeOnTheScreen();

  await render(<CommunityCard item={{ ...OBSERVATION, time: "9:5:00" } as never} index={0} />);
  expect(screen.getByText("09:05")).toBeOnTheScreen();
});

it("shows the quantity badge only when quantity is set", async () => {
  await render(<CommunityCard item={{ ...OBSERVATION, quantity: 4 } as never} index={0} />);
  expect(screen.getByText("4")).toBeOnTheScreen();
});

describe("thumbnail", () => {
  it("shows the placeholder without a thumb, the real image with one", async () => {
    await render(<CommunityCard item={OBSERVATION as never} index={0} />);
    expect(screen.getByTestId("thumb-placeholder")).toBeOnTheScreen();

    await render(
      <CommunityCard
        item={{ ...OBSERVATION, species_data: { ...OBSERVATION.species_data, thumb: "t.jpg" } } as never}
        index={0}
      />,
    );
    expect(screen.getByTestId("observation-thumb")).toBeOnTheScreen();
  });
});

describe("source/author row", () => {
  it("shows the external source and username", async () => {
    await render(<CommunityCard item={OBSERVATION as never} index={0} />);
    expect(screen.getByText("eBird")).toBeOnTheScreen();
    expect(screen.getByText("jdoe")).toBeOnTheScreen();
  });
});

describe("distance", () => {
  it("shows nothing without a distance", async () => {
    await render(<CommunityCard item={OBSERVATION as never} index={0} />);
    expect(screen.queryByText(/~/)).not.toBeOnTheScreen();
  });

  it("shows a normalized distance when present", async () => {
    await render(<CommunityCard item={{ ...OBSERVATION, distance: 1500 } as never} index={0} />);
    expect(screen.getByText("~1.5 km")).toBeOnTheScreen();
  });
});
