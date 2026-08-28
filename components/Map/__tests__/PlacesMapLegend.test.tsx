jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      key === "map_legend_from" ? `${opts?.count}+` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
jest.mock("../../../store/theme-context", () => ({
  useTheme: () => require("../../../screens/mockTheme").mockUseTheme(),
}));
jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import PlacesMapLegend from "../PlacesMapLegend";
import {
  DIARY_SCALE,
  MapSymbolScale,
  OBSERVATION_SCALE,
  SYMBOL_STROKE_WIDTH,
  SymbolSizeClass,
  outerRadius,
} from "../../../constants/mapSymbolScale";

const labelOf = (sizeClass: SymbolSizeClass) => {
  if (sizeClass.to == null) return `${sizeClass.from}+`;
  if (sizeClass.to === sizeClass.from) return `${sizeClass.from}`;
  return `${sizeClass.from}–${sizeClass.to}`;
};

const SCALES: [string, MapSymbolScale][] = [
  ["observations", OBSERVATION_SCALE],
  ["diaries", DIARY_SCALE],
];

describe("collapsed", () => {
  it("is only a button, so the map keeps its corner", async () => {
    await render(
      <PlacesMapLegend
        scale={OBSERVATION_SCALE}
        expanded={false}
        onToggle={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId("observations-map-legend-toggle"),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId("observations-map-legend")).toBeNull();
    expect(
      screen.queryByText(labelOf(OBSERVATION_SCALE.classes[0])),
    ).toBeNull();
  });

  it("says what it opens", async () => {
    await render(
      <PlacesMapLegend
        scale={OBSERVATION_SCALE}
        expanded={false}
        onToggle={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("map_legend_show")).toBeOnTheScreen();
  });

  it("asks to be opened when pressed", async () => {
    const onToggle = jest.fn();
    await render(
      <PlacesMapLegend
        scale={OBSERVATION_SCALE}
        expanded={false}
        onToggle={onToggle}
      />,
    );

    fireEvent.press(screen.getByTestId("observations-map-legend-toggle"));

    expect(onToggle).toHaveBeenCalled();
  });
});

describe.each(SCALES)("expanded, %s scale", (_name, scale) => {
  it("spells out every class the map draws", async () => {
    // The symbols carry no numbers, so a class the legend forgets is a size on
    // the map that means nothing.
    await render(
      <PlacesMapLegend scale={scale} expanded onToggle={jest.fn()} />,
    );

    for (const sizeClass of scale.classes) {
      expect(screen.getByText(labelOf(sizeClass))).toBeOnTheScreen();
    }
  });

  it("says what the sizes count", async () => {
    await render(
      <PlacesMapLegend scale={scale} expanded onToggle={jest.fn()} />,
    );
    expect(screen.getByText(scale.titleKey)).toBeOnTheScreen();
  });

  it("draws each circle the size the map draws it", async () => {
    // Regression: the legend sized its circles by circle-radius alone, but
    // MapLibre puts circle-stroke-width outside that radius while a React
    // Native border goes inside it. Every legend circle came out a full stroke
    // too small — 7 against 10 for the first class — so the legend quietly
    // misstated the very scale it exists to explain.
    await render(
      <PlacesMapLegend scale={scale} expanded onToggle={jest.fn()} />,
    );

    for (const sizeClass of scale.classes) {
      const style = StyleSheet.flatten(
        screen.getByTestId(`observations-map-legend-dot-${sizeClass.from}`)
          .props.style,
      );

      // Outer edge matches the map symbol's footprint...
      expect(style.width).toBe(outerRadius(sizeClass.radius) * 2);
      expect(style.height).toBe(outerRadius(sizeClass.radius) * 2);
      expect(style.borderRadius).toBe(outerRadius(sizeClass.radius));
      // ...and the ring eats inward, leaving a core of exactly circle-radius.
      expect(style.borderWidth).toBe(SYMBOL_STROKE_WIDTH);
    }
  });

  it("closes again when pressed", async () => {
    const onToggle = jest.fn();
    await render(<PlacesMapLegend scale={scale} expanded onToggle={onToggle} />);

    fireEvent.press(screen.getByTestId("observations-map-legend"));

    expect(onToggle).toHaveBeenCalled();
  });
});

describe("a class holding a single value", () => {
  it("is labelled as that value, not as a range", async () => {
    // The diaries scale opens with "exactly one outing"; "1–1" would be silly.
    await render(
      <PlacesMapLegend scale={DIARY_SCALE} expanded onToggle={jest.fn()} />,
    );

    expect(screen.getByText("1")).toBeOnTheScreen();
    expect(screen.queryByText("1–1")).toBeNull();
  });
});
