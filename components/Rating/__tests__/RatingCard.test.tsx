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
      main300: "#0f0",
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
jest.mock("../../Profile/ProfileAvatar", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>avatar</Text> };
});
jest.mock("@react-navigation/native", () => ({ useNavigation: () => mockNavigation }));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { createNavigationMock } from "../../../screens/test-utils";
import RatingCard from "../RatingCard";

const mockNavigation = createNavigationMock();
const mockOnToggle = jest.fn();

const RATING_ITEM = {
  profile_id: 9,
  first_name: "Jane",
  last_name: "Doe",
  username: "jdoe",
  avatar: null,
  territory_code: "FR",
  seen_qty: 42,
  last_update: "2026-01-01T08:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the index, territory flag, full name and seen count", async () => {
  await render(
    <RatingCard item={RATING_ITEM as never} index={4} isSelected={false} onToggle={mockOnToggle} profile={null} />,
  );
  expect(screen.getByText("5.")).toBeOnTheScreen();
  expect(screen.getByText("🇫🇷")).toBeOnTheScreen();
  expect(screen.getByText("Jane Doe")).toBeOnTheScreen();
  expect(screen.getByText("42")).toBeOnTheScreen();
});

it("omits the flag when there's no territory code", async () => {
  await render(
    <RatingCard
      item={{ ...RATING_ITEM, territory_code: null } as never}
      index={0}
      isSelected={false}
      onToggle={mockOnToggle}
      profile={null}
    />,
  );
  expect(screen.queryByText("🇫🇷")).not.toBeOnTheScreen();
});

describe("navigation on press", () => {
  it("goes to the current user's own Stat screen when the card is their own", async () => {
    await render(
      <RatingCard
        item={RATING_ITEM as never}
        index={0}
        isSelected={false}
        onToggle={mockOnToggle}
        profile={{ user: 9 } as never}
      />,
    );
    await fireEvent.press(screen.getByText("Jane Doe"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("Stat");
  });

  it("goes to UserStat for someone else's card", async () => {
    await render(
      <RatingCard
        item={RATING_ITEM as never}
        index={0}
        isSelected={false}
        onToggle={mockOnToggle}
        profile={{ user: 1 } as never}
      />,
    );
    await fireEvent.press(screen.getByText("Jane Doe"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("UserStat", { profileId: 9 });
  });

  it("goes to UserStat when there's no logged-in profile at all", async () => {
    await render(
      <RatingCard item={RATING_ITEM as never} index={0} isSelected={false} onToggle={mockOnToggle} profile={null} />,
    );
    await fireEvent.press(screen.getByText("Jane Doe"));
    expect(mockNavigation.navigate).toHaveBeenCalledWith("UserStat", { profileId: 9 });
  });
});

describe("selection checkbox", () => {
  it("shows an empty checkbox when not selected, a checked one when selected", async () => {
    await render(
      <RatingCard item={RATING_ITEM as never} index={0} isSelected={false} onToggle={mockOnToggle} profile={null} />,
    );
    expect(screen.getByTestId("icon-square-outline")).toBeOnTheScreen();

    await render(
      <RatingCard item={RATING_ITEM as never} index={0} isSelected={true} onToggle={mockOnToggle} profile={null} />,
    );
    expect(screen.getByTestId("icon-checkbox")).toBeOnTheScreen();
  });

  it("calls onToggle (not the row's own navigation) when the checkbox is pressed", async () => {
    await render(
      <RatingCard
        item={RATING_ITEM as never}
        index={0}
        isSelected={false}
        onToggle={mockOnToggle}
        profile={null}
      />,
    );
    await fireEvent.press(screen.getByTestId("icon-square-outline"));
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});
