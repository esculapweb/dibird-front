import i18n from "../../services/i18n";
import {
  isoToFlagEmoji,
  normalizeValue,
  toDateOnly,
  cleanFilters,
  stableStringify,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDateShort,
  formatMonthLabel,
  formatDayLabel,
  buildDateParams,
  roundCoords,
} from "../helpers";

const FIXED_DATE = "2024-01-15T12:00:00.000Z";

describe("isoToFlagEmoji", () => {
  it("returns an empty string for null input", () => {
    expect(isoToFlagEmoji(null)).toBe("");
  });

  it("converts a lowercase ISO code to a flag emoji", () => {
    expect(isoToFlagEmoji("us")).toBe("🇺🇸");
  });

  it("converts an uppercase ISO code to a flag emoji", () => {
    expect(isoToFlagEmoji("FR")).toBe("🇫🇷");
  });
});

describe("normalizeValue", () => {
  it("returns null when allowed_values is empty", () => {
    expect(normalizeValue("a", [])).toBeNull();
  });

  it("returns the first allowed value when value is null/undefined", () => {
    expect(normalizeValue(null, ["a", "b"])).toBe("a");
    expect(normalizeValue(undefined, ["a", "b"])).toBe("a");
  });

  it("returns the first allowed value when value is not in allowed_values", () => {
    expect(normalizeValue("z", ["a", "b"])).toBe("a");
  });

  it("returns the value unchanged when it is in allowed_values", () => {
    expect(normalizeValue("b", ["a", "b"])).toBe("b");
  });
});

describe("toDateOnly", () => {
  it("returns null for null/undefined input", () => {
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly(undefined)).toBeNull();
  });

  it("formats a Date instance as YYYY-MM-DD", () => {
    expect(toDateOnly(new Date(FIXED_DATE))).toBe("2024-01-15");
  });

  it("formats a date-only string (no time component) as YYYY-MM-DD", () => {
    expect(toDateOnly("2024-01-15")).toBe("2024-01-15");
  });
});

describe("cleanFilters", () => {
  it("drops null and undefined values", () => {
    expect(
      cleanFilters({ territory: null, place: undefined, species: 3 }),
    ).toEqual({ species: 3 });
  });

  it("keeps falsy-but-defined values (0, false, empty string)", () => {
    expect(cleanFilters({ favourite: false, radius: 0 })).toEqual({
      favourite: false,
      radius: 0,
    });
  });

  it("returns an empty object for an empty input", () => {
    expect(cleanFilters({})).toEqual({});
  });
});

describe("stableStringify", () => {
  it("returns null for null/undefined input", () => {
    expect(stableStringify(null)).toBeNull();
    expect(stableStringify(undefined)).toBeNull();
  });

  it("produces identical output regardless of key insertion order", () => {
    const a = stableStringify({ b: 2, a: 1 });
    const b = stableStringify({ a: 1, b: 2 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":1,"b":2}');
  });

  it("drops undefined-valued keys but keeps null-valued keys", () => {
    expect(stableStringify({ a: undefined, b: null })).toBe('{"b":null}');
  });
});

describe("date formatting (i18n.language dependent)", () => {
  const originalLanguage = i18n.language;

  afterEach(() => {
    i18n.language = originalLanguage;
  });

  it("formatDate returns an empty string for falsy input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
  });

  it("formatDate formats using the current i18n language", () => {
    i18n.language = "en";
    expect(formatDate(FIXED_DATE)).toBe("1/15/2024");
    i18n.language = "ru";
    expect(formatDate(FIXED_DATE)).toBe("15.01.2024");
  });

  it("formatDateLong formats a long-form date per language", () => {
    i18n.language = "en";
    expect(formatDateLong(FIXED_DATE)).toBe("January 15, 2024");
  });

  it("formatDateLong returns an empty string for falsy input", () => {
    expect(formatDateLong(null)).toBe("");
  });

  it("formatDateTime includes both date and time", () => {
    i18n.language = "en";
    expect(formatDateTime(FIXED_DATE)).toBe("01/15/2024, 12:00 PM");
  });

  it("formatDateTime returns an empty string for falsy input", () => {
    expect(formatDateTime(null)).toBe("");
  });

  it("formatDateShort returns null for falsy input", () => {
    expect(formatDateShort(null)).toBeNull();
  });

  it("formatDateShort returns a {d, y} shape", () => {
    i18n.language = "en";
    expect(formatDateShort(FIXED_DATE)).toEqual({ d: "Jan 15", y: "2024" });
  });

  it("formatMonthLabel and formatDayLabel format short month/day labels", () => {
    i18n.language = "en";
    expect(formatMonthLabel(FIXED_DATE)).toBe("Jan 2024");
    expect(formatDayLabel(FIXED_DATE)).toBe("Jan 15");
  });

  it("formatMonthLabel and formatDayLabel return an empty string for falsy input", () => {
    expect(formatMonthLabel(null)).toBe("");
    expect(formatDayLabel(undefined)).toBe("");
  });
});

describe("buildDateParams", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns {} for undefined or all-type filters", () => {
    expect(buildDateParams(undefined)).toEqual({});
    expect(buildDateParams({ type: "all" })).toEqual({});
  });

  it("resolves 'today' to a single-day min/max range", () => {
    expect(buildDateParams({ type: "today" })).toEqual({
      date_time_min: "2024-06-15",
      date_time_max: "2024-06-16",
    });
  });

  it("resolves 'this_year' to a full-year range", () => {
    expect(buildDateParams({ type: "this_year" })).toEqual({
      date_time_min: "2024-01-01",
      date_time_max: "2025-01-01",
    });
  });

  it("resolves 'year' to a full-year range for the given year", () => {
    expect(buildDateParams({ type: "year", year: 2020 })).toEqual({
      date_time_min: "2020-01-01",
      date_time_max: "2021-01-01",
    });
  });

  it("returns {} for 'year' type without a year", () => {
    expect(buildDateParams({ type: "year" })).toEqual({});
  });

  it("emits only the side of a 'range' filter that is present", () => {
    expect(buildDateParams({ type: "range", from: "2024-01-05" })).toEqual({
      date_time_min: "2024-01-05",
    });
    expect(buildDateParams({ type: "range", to: "2024-01-05" })).toEqual({
      date_time_max: "2024-01-06",
    });
  });
});

describe("roundCoords", () => {
  it("rounds both coordinates to 4 decimal places by default", () => {
    expect(roundCoords([27.12413523716059, 53.67784851150585])).toEqual([
      27.1241, 53.6778,
    ]);
  });

  it("returns null for null/undefined input", () => {
    expect(roundCoords(null)).toBeNull();
    expect(roundCoords(undefined)).toBeNull();
  });

  it("maps GPS-jitter-sized differences to the same rounded value", () => {
    const a = roundCoords([27.12413523716059, 53.67784851150585]);
    const b = roundCoords([27.124135237740607, 53.67784851149391]);
    expect(a).toEqual(b);
  });

  it("respects a custom precision", () => {
    expect(roundCoords([27.12413523716059, 53.67784851150585], 2)).toEqual([
      27.12, 53.68,
    ]);
  });
});
