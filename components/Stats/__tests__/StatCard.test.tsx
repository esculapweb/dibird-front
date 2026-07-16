jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => ({
    Colors: {
      primary100: "#fff",
      backgroundMain: "#f5f5f5",
      shadow: "#000",
      imageBg: "#eee",
      textMain: "#000",
      textSecondary: "#666",
      textMiddle: "#888",
      statIcon: "#999",
      main100: "#0a0",
      main300: "#0f0",
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

import { fireEvent, render, screen } from "@testing-library/react-native";
import { formatDate } from "../../../util/helpers";
import StatCard from "../StatCard";

const mockOnPress = jest.fn();
const mockOnToggle = jest.fn();

const SPECIES_ITEM = {
  sp_name_lang: "Blackbird",
  sp_latin: "Turdus merula",
  sp_thumb: null as string | null,
  seen: true,
  min_date: "2026-01-01",
  max_date: "2026-01-01",
  qty_observations: 3,
  qty_countries: 0,
  min_territory: null as string | null,
  max_territory: null as string | null,
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("renders the index, name and latin", async () => {
  await render(
    <StatCard item={SPECIES_ITEM as never} index={4} seenMode="all" onPress={mockOnPress} />,
  );
  expect(screen.getByText("5.")).toBeOnTheScreen();
  expect(screen.getByText("Blackbird")).toBeOnTheScreen();
  expect(screen.getByText("Turdus merula")).toBeOnTheScreen();
});

it("calls onPress when the row is tapped", async () => {
  await render(<StatCard item={SPECIES_ITEM as never} index={0} seenMode="all" onPress={mockOnPress} />);
  await fireEvent.press(screen.getByText("Blackbird"));
  expect(mockOnPress).toHaveBeenCalledTimes(1);
});

describe("thumbnail", () => {
  it("shows the placeholder without a thumb, the real image with one", async () => {
    await render(<StatCard item={SPECIES_ITEM as never} index={0} seenMode="all" onPress={mockOnPress} />);
    expect(screen.getByTestId("species-thumb-placeholder")).toBeOnTheScreen();

    await render(
      <StatCard item={{ ...SPECIES_ITEM, sp_thumb: "t.jpg" } as never} index={0} seenMode="all" onPress={mockOnPress} />,
    );
    expect(screen.getByTestId("species-thumb")).toBeOnTheScreen();
  });
});

describe("eye-off indicator next to the title", () => {
  it("shows only for an unseen item while specifically on the 'unseen' tab", async () => {
    await render(
      <StatCard item={{ ...SPECIES_ITEM, seen: false } as never} index={0} seenMode="unseen" onPress={mockOnPress} />,
    );
    expect(screen.getByTestId("icon-eye-off-outline")).toBeOnTheScreen();
  });

  it("does not show on the 'all' tab (a different unseen hint takes over instead)", async () => {
    await render(
      <StatCard item={{ ...SPECIES_ITEM, seen: false } as never} index={0} seenMode="all" onPress={mockOnPress} />,
    );
    expect(screen.getByText("not_observed_yet")).toBeOnTheScreen();
  });

  it("never shows for a seen item", async () => {
    await render(
      <StatCard item={{ ...SPECIES_ITEM, seen: true } as never} index={0} seenMode="unseen" onPress={mockOnPress} />,
    );
    expect(screen.queryByTestId("icon-eye-off-outline")).not.toBeOnTheScreen();
  });
});

describe("countries flags", () => {
  it("shows nothing when the item hasn't been seen", async () => {
    await render(
      <StatCard
        item={{ ...SPECIES_ITEM, seen: false, min_territory: "FR" } as never}
        index={0}
        seenMode="all"
        onPress={mockOnPress}
      />,
    );
    expect(screen.queryByText(/🇫🇷/)).not.toBeOnTheScreen();
  });

  it("shows a single flag when min and max territory match", async () => {
    await render(
      <StatCard
        item={{ ...SPECIES_ITEM, min_territory: "FR", max_territory: "FR" } as never}
        index={0}
        seenMode="all"
        onPress={mockOnPress}
      />,
    );
    expect(screen.getByText("🇫🇷")).toBeOnTheScreen();
  });

  it("shows both flags when min and max territory differ", async () => {
    await render(
      <StatCard
        item={{ ...SPECIES_ITEM, min_territory: "FR", max_territory: "DE" } as never}
        index={0}
        seenMode="all"
        onPress={mockOnPress}
      />,
    );
    expect(screen.getByText("🇫🇷🇩🇪")).toBeOnTheScreen();
  });

  it("appends a '+N' suffix once more than 2 countries are involved", async () => {
    await render(
      <StatCard
        item={{ ...SPECIES_ITEM, min_territory: "FR", max_territory: "DE", qty_countries: 5 } as never}
        index={0}
        seenMode="all"
        onPress={mockOnPress}
      />,
    );
    expect(screen.getByText("🇫🇷🇩🇪 +3")).toBeOnTheScreen();
  });
});

describe("seen meta row", () => {
  it("shows a single date when min and max date match", async () => {
    await render(<StatCard item={SPECIES_ITEM as never} index={0} seenMode="all" onPress={mockOnPress} />);
    expect(screen.getByText(formatDate("2026-01-01"))).toBeOnTheScreen();
  });

  it("shows a date range when min and max date differ", async () => {
    await render(
      <StatCard
        item={{ ...SPECIES_ITEM, min_date: "2026-01-01", max_date: "2026-03-01" } as never}
        index={0}
        seenMode="all"
        onPress={mockOnPress}
      />,
    );
    expect(
      screen.getByText(`${formatDate("2026-01-01")} – ${formatDate("2026-03-01")}`),
    ).toBeOnTheScreen();
  });

  it("shows the observation count badge", async () => {
    await render(
      <StatCard item={{ ...SPECIES_ITEM, qty_observations: 7 } as never} index={0} seenMode="all" onPress={mockOnPress} />,
    );
    expect(screen.getByText("7")).toBeOnTheScreen();
  });

  it("shows none of this for an unseen item", async () => {
    await render(
      <StatCard item={{ ...SPECIES_ITEM, seen: false } as never} index={0} seenMode="all" onPress={mockOnPress} />,
    );
    expect(screen.queryByText(formatDate("2026-01-01"))).not.toBeOnTheScreen();
  });
});

describe("add-to-checklist button", () => {
  it("is hidden when the item is already seen, even in personal mode", async () => {
    await render(
      <StatCard item={SPECIES_ITEM as never} index={0} seenMode="all" onPress={mockOnPress} personal onToggle={mockOnToggle} />,
    );
    expect(screen.queryByTestId("icon-add-circle-outline")).not.toBeOnTheScreen();
  });

  it("is hidden for an unseen item when not in personal mode", async () => {
    await render(
      <StatCard item={{ ...SPECIES_ITEM, seen: false } as never} index={0} seenMode="all" onPress={mockOnPress} onToggle={mockOnToggle} />,
    );
    expect(screen.queryByTestId("icon-add-circle-outline")).not.toBeOnTheScreen();
  });

  it("shows for an unseen item in personal mode, and calls onToggle when pressed", async () => {
    await render(
      <StatCard
        item={{ ...SPECIES_ITEM, seen: false } as never}
        index={0}
        seenMode="all"
        onPress={mockOnPress}
        personal
        onToggle={mockOnToggle}
      />,
    );
    await fireEvent.press(screen.getByTestId("icon-add-circle-outline"));
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnPress).not.toHaveBeenCalled();
  });
});
