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
      statIcon: "#999",
      main100: "#0a0",
      border: "#ccc",
    },
  }),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({
      name,
      testID,
      style,
    }: {
      name: string;
      testID?: string;
      style?: unknown;
    }) => (
      <Text testID={testID ?? `icon-${name}`} style={style}>
        {name}
      </Text>
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

import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import ChecklistCard from "../ChecklistCard";

const mockOnPress = jest.fn();
const mockOnToggle = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("order divider", () => {
  const ORDER_ITEM = { type: "order", name_lang: "Perching birds", latin: "Passeriformes", total: 0, seen_count: 0 };

  it("shows the order label, name and latin (with a dot separator)", async () => {
    await render(
      <ChecklistCard item={ORDER_ITEM as never} index={0} onPress={mockOnPress} onToggle={mockOnToggle} />,
    );
    expect(screen.getByText("order")).toBeOnTheScreen();
    expect(screen.getByText("Perching birds")).toBeOnTheScreen();
    expect(screen.getByText("Passeriformes")).toBeOnTheScreen();
    expect(screen.getByText("·")).toBeOnTheScreen();
  });

  it("omits the latin name and dot when there's none", async () => {
    await render(
      <ChecklistCard item={{ ...ORDER_ITEM, latin: null } as never} index={0} onPress={mockOnPress} onToggle={mockOnToggle} />,
    );
    expect(screen.queryByText("·")).not.toBeOnTheScreen();
  });

  it("shows a seen/total count when there's a total but it isn't complete", async () => {
    await render(
      <ChecklistCard
        item={{ ...ORDER_ITEM, total: 10, seen_count: 3 } as never}
        index={0}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.getByText("3 / 10")).toBeOnTheScreen();
  });

  it("shows an 'all' badge instead once seen_count reaches total", async () => {
    await render(
      <ChecklistCard
        item={{ ...ORDER_ITEM, total: 10, seen_count: 10 } as never}
        index={0}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.getByText("all")).toBeOnTheScreen();
    expect(screen.queryByText("10 / 10")).not.toBeOnTheScreen();
  });

  it("shows neither a count nor a badge when there's no total yet", async () => {
    await render(
      <ChecklistCard item={ORDER_ITEM as never} index={0} onPress={mockOnPress} onToggle={mockOnToggle} />,
    );
    expect(screen.queryByText("all")).not.toBeOnTheScreen();
    expect(screen.queryByText(/\//)).not.toBeOnTheScreen();
  });
});

describe("family divider", () => {
  const FAMILY_ITEM = { type: "family", name_lang: "Thrushes", latin: "Turdidae", total: 5, seen_count: 5 };

  it("shows the family label, name, and an 'all' badge once complete", async () => {
    await render(
      <ChecklistCard item={FAMILY_ITEM as never} index={0} onPress={mockOnPress} onToggle={mockOnToggle} />,
    );
    expect(screen.getByText("family")).toBeOnTheScreen();
    expect(screen.getByText("Thrushes")).toBeOnTheScreen();
    expect(screen.getByText("Turdidae")).toBeOnTheScreen();
    expect(screen.getByText("all")).toBeOnTheScreen();
  });

  it("shows a seen/total count when not yet complete", async () => {
    await render(
      <ChecklistCard
        item={{ ...FAMILY_ITEM, seen_count: 2 } as never}
        index={0}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.getByText("2 / 5")).toBeOnTheScreen();
  });
});

describe("species row", () => {
  const SPECIES_ITEM = { type: "species", name_lang: "Blackbird", latin: "Turdus merula", thumb: null, seen: false };

  it("renders the species name and latin", async () => {
    await render(
      <ChecklistCard item={SPECIES_ITEM as never} index={0} onPress={mockOnPress} onToggle={mockOnToggle} />,
    );
    expect(screen.getByText("Blackbird")).toBeOnTheScreen();
    expect(screen.getByText("Turdus merula")).toBeOnTheScreen();
  });

  it("adds the occurrence status of the species on that territory", async () => {
    await render(
      <ChecklistCard
        item={{ ...SPECIES_ITEM, occurrence: "Rare/Accidental", status: "LC" } as never}
        index={0}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.getByText("country_status_rare_accidental")).toBeOnTheScreen();
  });

  it("skips an occurrence status that only spells out the IUCN category", async () => {
    // Avibase reuses the field for the conservation category; repeating it
    // would say the same thing twice.
    await render(
      <ChecklistCard
        item={{ ...SPECIES_ITEM, occurrence: "Vulnerable", status: "VU" } as never}
        index={0}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.queryByText(/vulnerable/i)).toBeNull();
    expect(screen.queryByText(/country_status_/)).toBeNull();
  });

  it("leaves the line out where there is no occurrence status at all", async () => {
    await render(
      <ChecklistCard item={SPECIES_ITEM as never} index={0} onPress={mockOnPress} onToggle={mockOnToggle} />,
    );
    expect(screen.queryByText(/country_status_/)).toBeNull();
  });

  it("badges a threatened species on its photo, and leaves the rest alone", async () => {
    await render(
      <ChecklistCard
        item={{ ...SPECIES_ITEM, status: "EN" } as never}
        index={0}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.getByText("EN")).toBeOnTheScreen();

    await render(
      <ChecklistCard
        item={{ ...SPECIES_ITEM, status: "LC" } as never}
        index={0}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.queryByText("LC")).toBeNull();
  });

  it("shows the real thumbnail or a placeholder based on the item's own thumb", async () => {
    await render(
      <ChecklistCard item={SPECIES_ITEM as never} index={0} onPress={mockOnPress} onToggle={mockOnToggle} />,
    );
    expect(screen.getByTestId("species-thumb-placeholder")).toBeOnTheScreen();

    await render(
      <ChecklistCard
        item={{ ...SPECIES_ITEM, thumb: "t.jpg" } as never}
        index={0}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.getByTestId("species-thumb")).toBeOnTheScreen();
  });

  it("shows an empty checkbox for an unseen species, a checked one for a seen one", async () => {
    await render(
      <ChecklistCard item={SPECIES_ITEM as never} index={0} onPress={mockOnPress} onToggle={mockOnToggle} />,
    );
    expect(screen.getByTestId("icon-square-outline")).toBeOnTheScreen();

    await render(
      <ChecklistCard
        item={{ ...SPECIES_ITEM, seen: true } as never}
        index={0}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.getByTestId("icon-checkbox")).toBeOnTheScreen();
  });

  it("presses on the row call onPress, presses on the checkbox call onToggle", async () => {
    await render(
      <ChecklistCard item={SPECIES_ITEM as never} index={0} onPress={mockOnPress} onToggle={mockOnToggle} />,
    );

    await fireEvent.press(screen.getByText("Blackbird"));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("icon-square-outline"));
    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
});

describe("catalogue mode (personal={false})", () => {
  // The country page reuses this card as a plain reference list: no checkbox,
  // no progress, nothing dimmed — "seen" there would beg the question "when?".
  const SPECIES_ITEM = { type: "species", name_lang: "Blackbird", latin: "Turdus merula", thumb: null, seen: false };
  const ORDER_ITEM = { type: "order", name_lang: "Perching birds", latin: "Passeriformes", total: 5, seen_count: 2 };

  it("drops the seen checkbox for a chevron", async () => {
    await render(
      <ChecklistCard
        item={SPECIES_ITEM as never}
        index={0}
        personal={false}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.queryByTestId("icon-square-outline")).toBeNull();
    expect(screen.queryByTestId("icon-checkbox")).toBeNull();
    expect(screen.getByTestId("icon-chevron-forward")).toBeOnTheScreen();
  });

  it("centres the chevron instead of stretching it over the card", async () => {
    // Ionicons renders a Text: stretched to the card's height the glyph sits
    // at the top of the box, not next to the name it points at.
    await render(
      <ChecklistCard
        item={SPECIES_ITEM as never}
        index={0}
        personal={false}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );

    const style = StyleSheet.flatten(
      screen.getByTestId("icon-chevron-forward").props.style,
    );
    expect(style.alignSelf).toBe("center");
  });

  it("shows a group's plain species count instead of a seen/total score", async () => {
    await render(
      <ChecklistCard
        item={ORDER_ITEM as never}
        index={0}
        personal={false}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    expect(screen.getByText("5")).toBeOnTheScreen();
    expect(screen.queryByText("2 / 5")).toBeNull();
  });

  it("still keeps the seen/total score on the personal checklist", async () => {
    await render(
      <ChecklistCard item={ORDER_ITEM as never} index={0} onPress={mockOnPress} onToggle={mockOnToggle} />,
    );
    expect(screen.getByText("2 / 5")).toBeOnTheScreen();
  });

  it("opens the species from the row, the only gesture left", async () => {
    await render(
      <ChecklistCard
        item={SPECIES_ITEM as never}
        index={0}
        personal={false}
        onPress={mockOnPress}
        onToggle={mockOnToggle}
      />,
    );
    await fireEvent.press(screen.getByText("Blackbird"));
    expect(mockOnPress).toHaveBeenCalled();
    expect(mockOnToggle).not.toHaveBeenCalled();
  });
});
