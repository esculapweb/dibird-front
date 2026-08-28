/**
 * Symbol sizes for the place maps — the single source both the map layers and
 * the legend read, so the two can never drift apart.
 *
 * Range-graded (classed), not proportional, and that is deliberate. Encoding a
 * count by circle *area* is the usual advice, but it only works while the data
 * range fits the size range: on a phone the usable radii span ~7-22 px, about
 * 10x in area, while a birding history spans 1 to several thousand
 * observations per place — three or four orders of magnitude. Forcing
 * proportionality onto that either makes small places invisible or big ones
 * swallow the screen. The standard answer for a range this wide is a handful
 * of explicit classes plus a legend that states them, which claims no more
 * precision than it delivers. The exact number is one tap away.
 */
export interface SymbolSizeClass {
  /** Lowest count in the class. */
  from: number;
  /** Highest count, or null for the open-ended top class. */
  to: number | null;
  /** Circle radius in screen pixels (excludes the stroke drawn around it). */
  radius: number;
}

export interface MapSymbolScale {
  classes: SymbolSizeClass[];
  /** Feature property holding the count a single place is sized by. */
  countProperty: string;
  /** i18n key for the legend heading — what the sizes are counting. */
  titleKey: string;
}

/** Observations per place: decades, because the range spans that much. */
export const OBSERVATION_SCALE: MapSymbolScale = {
  classes: [
    { from: 1, to: 9, radius: 7 },
    { from: 10, to: 99, radius: 11 },
    { from: 100, to: 999, radius: 16 },
    { from: 1000, to: null, radius: 22 },
  ],
  countProperty: "observation_count",
  titleKey: "observations",
};

/**
 * Outings per place. Deliberately not the decades above: an outing is a whole
 * trip, so even a lifetime patch runs to tens, not thousands. On decade breaks
 * nearly every place would land in the first class and the map would read flat.
 */
export const DIARY_SCALE: MapSymbolScale = {
  classes: [
    { from: 1, to: 1, radius: 7 },
    { from: 2, to: 4, radius: 11 },
    { from: 5, to: 9, radius: 16 },
    { from: 10, to: null, radius: 22 },
  ],
  countProperty: "diary_place_count",
  titleKey: "diaries",
};

/** White ring around every symbol. */
export const SYMBOL_STROKE_WIDTH = 3;

/**
 * How much room a symbol actually takes on screen.
 *
 * MapLibre places `circle-stroke-width` *outside* `circle-radius` (style spec),
 * so the ring adds to the footprint instead of eating into it. A React Native
 * `borderWidth` does the opposite — it is drawn inside the box. Anything
 * redrawing these symbols off the map (the legend) has to add the stroke back
 * by hand, or its circles come out a full stroke too small: 7 against 10 for
 * the first class, which is where the legend stopped matching the map.
 */
export const outerRadius = (radius: number): number =>
  radius + SYMBOL_STROKE_WIDTH;

/** Room the largest symbol needs — what the legend sizes its rows by. */
export const maxOuterRadius = (scale: MapSymbolScale): number =>
  outerRadius(Math.max(...scale.classes.map((sizeClass) => sizeClass.radius)));

/** How far the "this is several places" halo extends past a cluster. */
export const CLUSTER_HALO_SPREAD = 7;

/** Cluster property the source accumulates the per-place count into. */
export const CLUSTER_TOTAL_PROPERTY = "total";

/**
 * Builds the MapLibre `step` expression that maps a count to a radius. `step`
 * is the expression for classed symbols: it holds each class flat instead of
 * interpolating between them, which is exactly what a range-graded scale
 * promises. `countInput` is the expression producing the count.
 */
export const radiusStepExpression = (
  scale: MapSymbolScale,
  countInput: unknown,
  extraRadius = 0,
): unknown[] => [
  "step",
  countInput,
  scale.classes[0].radius + extraRadius,
  ...scale.classes.slice(1).flatMap((sizeClass) => [
    sizeClass.from,
    sizeClass.radius + extraRadius,
  ]),
];

/**
 * The same mapping in TypeScript, for code that has to know how big a symbol
 * came out — hit-testing a tap against overlapping symbols, for one. Kept
 * beside radiusStepExpression on purpose: the two must agree, or a tap lands
 * on a different circle than the one drawn under the finger.
 */
export const radiusForCount = (scale: MapSymbolScale, count: number): number => {
  let radius = scale.classes[0].radius;
  for (const sizeClass of scale.classes) {
    if (count >= sizeClass.from) radius = sizeClass.radius;
  }
  return radius;
};

/** The count a single place symbol is sized by. */
export const placeCountInput = (scale: MapSymbolScale): unknown[] => [
  "get",
  scale.countProperty,
];

/**
 * The count a cluster symbol is sized by: the per-place counts the source
 * accumulates.
 *
 * Falls back to `point_count`, which clustering always provides, so that if the
 * accumulated property ever goes missing (it did once — see the
 * clusterProperties note in PlacesMap) a cluster is sized by how many places it
 * holds rather than dropping to the smallest class. That is still wrong, but it
 * stays monotonic: a fuller cluster never draws smaller than an emptier one.
 */
export const CLUSTER_COUNT_INPUT = [
  "coalesce",
  ["get", CLUSTER_TOTAL_PROPERTY],
  ["get", "point_count"],
];
