jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
      compareP1: "#f00",
      compareP2: "#00f",
    },
  }),
}));
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: (props: Record<string, unknown>) => <View testID="species-thumb" {...props} />,
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import RatingCompareCard from "../RatingCompareCard";

const mockOnPress = jest.fn();

const ITEM = {
  name_lang: "Blackbird",
  name_latin: "Turdus merula",
  thumb: null as string | null,
  in_object: [false, false] as [boolean, boolean],
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the index, name and latin", async () => {
  await render(<RatingCompareCard item={ITEM as never} index={2} onPress={mockOnPress} />);
  expect(screen.getByText("3.")).toBeOnTheScreen();
  expect(screen.getByText("Blackbird")).toBeOnTheScreen();
  expect(screen.getByText("Turdus merula")).toBeOnTheScreen();
});

it("badges a threatened species on its photo, and leaves the rest alone", async () => {
  await render(
    <RatingCompareCard
      item={{ ...ITEM, status: "CR" } as never}
      index={0}
      onPress={mockOnPress}
    />,
  );
  expect(screen.getByText("CR")).toBeOnTheScreen();

  await render(
    <RatingCompareCard
      item={{ ...ITEM, status: "LC" } as never}
      index={0}
      onPress={mockOnPress}
    />,
  );
  expect(screen.queryByText("LC")).toBeNull();
});

it("calls onPress when tapped", async () => {
  await render(<RatingCompareCard item={ITEM as never} index={0} onPress={mockOnPress} />);
  await fireEvent.press(screen.getByText("Blackbird"));
  expect(mockOnPress).toHaveBeenCalledTimes(1);
});

describe("thumbnail", () => {
  it("shows a plain placeholder without a thumb", async () => {
    await render(<RatingCompareCard item={ITEM as never} index={0} onPress={mockOnPress} />);
    expect(screen.queryByTestId("species-thumb")).not.toBeOnTheScreen();
  });

  it("shows the real image when a thumb is available", async () => {
    await render(<RatingCompareCard item={{ ...ITEM, thumb: "t.jpg" } as never} index={0} onPress={mockOnPress} />);
    expect(screen.getByTestId("species-thumb")).toBeOnTheScreen();
  });
});

it("does not crash when in_object is absent, treating both profiles as not-seen", async () => {
  const { in_object: _unused, ...rest } = ITEM;
  await render(<RatingCompareCard item={rest as never} index={0} onPress={mockOnPress} />);
  expect(screen.getByText("Blackbird")).toBeOnTheScreen();
});
