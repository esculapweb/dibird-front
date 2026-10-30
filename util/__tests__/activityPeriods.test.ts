import i18n from "../../services/i18n";
import {
  axisLabelIndexes,
  deltaWindowLabel,
  formatAxisLabel,
  formatPeriodLabel,
  niceMax,
  periodRange,
  topPeriodIndexes,
} from "../activityPeriods";

beforeEach(() => {
  i18n.language = "en";
});

describe("periodRange", () => {
  // The server clips the first week to the requested start (a Wednesday);
  // the following ones start on Mondays.
  const WEEKS = ["2026-05-13", "2026-05-18", "2026-05-25"];

  it("ends a column the day before the next one starts", () => {
    expect(periodRange(WEEKS, 0, "week", "2026-05-26")).toEqual({
      from: "2026-05-13",
      to: "2026-05-17",
    });
  });

  it("ends the last column at the range's last day, not a full week later", () => {
    expect(periodRange(WEEKS, 2, "week", "2026-05-26")).toEqual({
      from: "2026-05-25",
      to: "2026-05-26",
    });
  });

  it("rolls months over December", () => {
    expect(
      periodRange(["2025-11-20", "2025-12-01", "2026-01-01"], 1, "month", "2026-01-10"),
    ).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("opens the whole day for an hourly column", () => {
    const hours = ["2026-05-01T07:00:00+03:00", "2026-05-01T08:00:00+03:00"];
    expect(periodRange(hours, 0, "hour", "2026-05-01")).toEqual({
      from: "2026-05-01",
      to: "2026-05-01",
    });
  });
});

describe("formatPeriodLabel", () => {
  it("reads the hour off the string, not through the device's time zone", () => {
    const hours = ["2026-05-01T07:00:00+03:00", "2026-05-01T08:00:00+03:00"];
    expect(formatPeriodLabel(hours, 0, "hour", "2026-05-01")).toBe(
      "May 1, 07:00–08:00",
    );
  });

  it("shows a week as its clipped range", () => {
    expect(
      formatPeriodLabel(["2026-05-13", "2026-05-18"], 0, "week", "2026-05-20"),
    ).toBe("May 13 – May 17");
  });

  it("shows a single-day week as one date", () => {
    expect(formatPeriodLabel(["2026-05-25"], 0, "week", "2026-05-25")).toBe(
      "May 25",
    );
  });

  it("shows a day with its year", () => {
    expect(formatPeriodLabel(["2026-05-01"], 0, "day", "2026-05-01")).toBe(
      "May 1, 2026",
    );
  });

  it("does not shift a date-only start into the previous day", () => {
    // new Date("2026-05-01") is UTC midnight — April 30 west of Greenwich.
    expect(formatAxisLabel("2026-05-01", "day")).toBe("May 1");
  });
});

describe("axisLabelIndexes", () => {
  it("always labels the last column", () => {
    expect(axisLabelIndexes(30)).toEqual([5, 11, 17, 23, 29]);
  });

  it("labels every column when there are few", () => {
    expect(axisLabelIndexes(3)).toEqual([0, 1, 2]);
  });

  it("keeps the count near the maximum", () => {
    expect(axisLabelIndexes(53).length).toBeLessThanOrEqual(5);
  });

  it("returns nothing for an empty series", () => {
    expect(axisLabelIndexes(0)).toEqual([]);
  });
});

describe("topPeriodIndexes", () => {
  it("orders by value and drops empty columns", () => {
    expect(topPeriodIndexes([0, 3, 0, 7, 1])).toEqual([3, 1, 4]);
  });

  it("prefers the more recent column on a tie", () => {
    expect(topPeriodIndexes([2, 5, 2])).toEqual([1, 2, 0]);
  });

  it("caps the list", () => {
    expect(topPeriodIndexes([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([6, 5, 4]);
  });
});

describe("niceMax", () => {
  it.each([
    [0, 1],
    [1, 1],
    [3, 4],
    [7, 8],
    [10, 10],
    [11, 20],
    [21, 40],
    [55, 60],
  ])("rounds %i up to %i", (max, expected) => {
    expect(niceMax(max)).toBe(expected);
  });
});

describe("deltaWindowLabel", () => {
  const t = ((key: string, opts?: Record<string, unknown>) =>
    `${key}:${JSON.stringify(opts)}`) as unknown as Parameters<typeof deltaWindowLabel>[0];

  it("names the day window the server compared", () => {
    expect(deltaWindowLabel(t, { delta_window: { unit: "days", n: 30 } })).toBe(
      'activity_delta_days:{"count":30}',
    );
  });

  it("names an hour window", () => {
    expect(deltaWindowLabel(t, { delta_window: { unit: "hours", n: 3 } })).toBe(
      'activity_delta_hours:{"count":3}',
    );
  });

  it("returns nothing when there was nothing to compare", () => {
    expect(
      deltaWindowLabel(t, { delta_window: null, delta_label_key: "this_week" }),
    ).toBeNull();
  });

  it("falls back to the old key for responses without the window", () => {
    // An offline cache entry written before the backend sent delta_window.
    expect(
      deltaWindowLabel(t, { delta_label_key: "this_week", recent_window: 7 }),
    ).toBe('this_week:{"n":7}');
  });
});
