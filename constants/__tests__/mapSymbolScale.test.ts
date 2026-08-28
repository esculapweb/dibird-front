import {
  CLUSTER_COUNT_INPUT,
  DIARY_SCALE,
  MapSymbolScale,
  OBSERVATION_SCALE,
  SYMBOL_STROKE_WIDTH,
  maxOuterRadius,
  outerRadius,
  placeCountInput,
  radiusForCount,
  radiusStepExpression,
} from "../mapSymbolScale";

// Mirrors how MapLibre evaluates a `step`: the output before the first stop,
// then the output of the last stop the input has reached.
const evaluateStep = (expression: unknown[], value: number): number => {
  const [, , first, ...rest] = expression as [
    string,
    unknown,
    number,
    ...number[],
  ];
  let result = first;
  for (let i = 0; i < rest.length; i += 2) {
    if (value >= rest[i]) result = rest[i + 1];
  }
  return result;
};

const SCALES: [string, MapSymbolScale][] = [
  ["observations", OBSERVATION_SCALE],
  ["diaries", DIARY_SCALE],
];

describe.each(SCALES)("%s scale", (_name, scale) => {
  const neighbours = scale.classes
    .slice(0, -1)
    .map((sizeClass, i) => ({ sizeClass, next: scale.classes[i + 1] }));
  const closed = scale.classes.filter((sizeClass) => sizeClass.to != null);

  it("leaves no gap or overlap between neighbours", () => {
    // Every count lands in exactly one class — a legend that claims otherwise
    // would be lying about the map.
    expect(neighbours.map(({ sizeClass }) => sizeClass.to)).toEqual(
      neighbours.map(({ next }) => next.from - 1),
    );
  });

  it("sizes the same in TypeScript as it does in the style expression", () => {
    // Hit-testing a tap against overlapping symbols reads the radius through
    // radiusForCount while MapLibre draws it from the step expression. If the
    // two ever disagree, a tap lands on a different circle than the one under
    // the finger.
    const expression = radiusStepExpression(scale, placeCountInput(scale));
    const counts = scale.classes.flatMap((sizeClass) => [
      sizeClass.from - 1,
      sizeClass.from,
      sizeClass.to ?? sizeClass.from + 1000,
    ]);

    expect(counts.map((count) => radiusForCount(scale, count))).toEqual(
      counts.map((count) => evaluateStep(expression, count)),
    );
  });

  it("grows with the count", () => {
    expect(
      neighbours.map(({ next, sizeClass }) => next.radius > sizeClass.radius),
    ).toEqual(neighbours.map(() => true));
  });

  it("ends open, so no count falls off the top", () => {
    expect(scale.classes[scale.classes.length - 1].to).toBeNull();
  });

  it("starts at one", () => {
    expect(scale.classes[0].from).toBe(1);
  });

  it("gives every class its own radius", () => {
    const expression = radiusStepExpression(scale, CLUSTER_COUNT_INPUT);

    expect(
      scale.classes.map((sizeClass) => evaluateStep(expression, sizeClass.from)),
    ).toEqual(scale.classes.map((sizeClass) => sizeClass.radius));
  });

  it("holds that radius flat all the way to the top of the class", () => {
    // What separates a classed scale from an interpolated one.
    const expression = radiusStepExpression(scale, CLUSTER_COUNT_INPUT);

    expect(
      closed.map((sizeClass) => evaluateStep(expression, sizeClass.to!)),
    ).toEqual(closed.map((sizeClass) => sizeClass.radius));
  });

  it("holds the top class open", () => {
    const expression = radiusStepExpression(scale, CLUSTER_COUNT_INPUT);
    const top = scale.classes[scale.classes.length - 1];

    expect(evaluateStep(expression, top.from * 1000)).toBe(top.radius);
  });

  it("offsets every class by the same amount for the cluster halo", () => {
    const plain = radiusStepExpression(scale, CLUSTER_COUNT_INPUT);
    const haloed = radiusStepExpression(scale, CLUSTER_COUNT_INPUT, 7);

    expect(
      scale.classes.map((sizeClass) => evaluateStep(haloed, sizeClass.from)),
    ).toEqual(
      scale.classes.map(
        (sizeClass) => evaluateStep(plain, sizeClass.from) + 7,
      ),
    );
  });

  it("keeps the stops ascending, as `step` requires", () => {
    const stops = radiusStepExpression(scale, CLUSTER_COUNT_INPUT)
      .slice(3)
      .filter((_, i) => i % 2 === 0) as number[];

    expect(stops).toEqual([...stops].sort((a, b) => a - b));
  });

  it("reads the count property it is sized by", () => {
    expect(placeCountInput(scale)).toEqual(["get", scale.countProperty]);
  });

  it("reserves room for its largest symbol, stroke included", () => {
    const largest = Math.max(
      ...scale.classes.map((sizeClass) => sizeClass.radius),
    );
    expect(maxOuterRadius(scale)).toBe(largest + SYMBOL_STROKE_WIDTH);
  });
});

describe("the two scales", () => {
  it("count different things", () => {
    expect(OBSERVATION_SCALE.countProperty).toBe("observation_count");
    // Not diary_count: that one is derived through observations and misses an
    // outing with nothing recorded in it yet.
    expect(DIARY_SCALE.countProperty).toBe("diary_place_count");
  });

  it("break at magnitudes that suit their own data", () => {
    // Outings run to tens, observations to thousands; decade breaks on both
    // would leave nearly every place in the diaries map's first class.
    expect(OBSERVATION_SCALE.classes.map((c) => c.from)).toEqual([
      1, 10, 100, 1000,
    ]);
    expect(DIARY_SCALE.classes.map((c) => c.from)).toEqual([1, 2, 5, 10]);
  });

  it("draw at the same sizes, so the two maps read alike", () => {
    expect(DIARY_SCALE.classes.map((c) => c.radius)).toEqual(
      OBSERVATION_SCALE.classes.map((c) => c.radius),
    );
  });
});

describe("outerRadius", () => {
  it("adds the stroke MapLibre draws outside the radius", () => {
    expect(outerRadius(7)).toBe(7 + SYMBOL_STROKE_WIDTH);
  });
});

describe("CLUSTER_COUNT_INPUT", () => {
  it("falls back to the place count if the summed property goes missing", () => {
    expect(CLUSTER_COUNT_INPUT).toEqual([
      "coalesce",
      ["get", "total"],
      ["get", "point_count"],
    ]);
  });
});
