import { buildDeepLinkParams } from "../buildDeepLinkParams";
import { parseDeepLinkParams } from "../parseDeepLinkParams";

describe("buildDeepLinkParams", () => {
  it("returns an empty object for null/empty filters and no sort", () => {
    expect(buildDeepLinkParams(null, null)).toEqual({});
    expect(buildDeepLinkParams({}, null)).toEqual({});
  });

  it("copies territory/place/species when present", () => {
    expect(
      buildDeepLinkParams({ territory: 1, place: 2, species: 3 }, null),
    ).toEqual({ territory: 1, place: 2, species: 3 });
  });

  it("maps a year-type date filter to params.year", () => {
    expect(
      buildDeepLinkParams({ date: { type: "year", year: 2024 } }, null),
    ).toEqual({ year: 2024 });
  });

  it("does not emit date params for today/all-type filters", () => {
    expect(buildDeepLinkParams({ date: { type: "today" } }, null)).toEqual({});
    expect(buildDeepLinkParams({ date: { type: "all" } }, null)).toEqual({});
  });

  it("formats a range date filter as UTC date_time_min/max", () => {
    expect(
      buildDeepLinkParams(
        {
          date: {
            type: "range",
            from: "2024-01-05T00:00:00.000Z",
            to: "2024-02-10T00:00:00.000Z",
          },
        },
        null,
      ),
    ).toEqual({ date_time_min: "2024-01-05", date_time_max: "2024-02-10" });
  });

  it("emits only the side of the range that is present", () => {
    expect(
      buildDeepLinkParams(
        { date: { type: "range", from: "2024-01-05T00:00:00.000Z" } },
        null,
      ),
    ).toEqual({ date_time_min: "2024-01-05" });
  });

  it("adds sort as params.o when provided", () => {
    expect(buildDeepLinkParams({}, "-created")).toEqual({ o: "-created" });
  });

  it("copies source and radius when set, and skips them when they are not", () => {
    expect(buildDeepLinkParams({ source: "ebird", radius: 25 }, null)).toEqual({
      source: "ebird",
      radius: 25,
    });
    expect(buildDeepLinkParams({ source: null, radius: null }, null)).toEqual({});
  });

  it("keeps both sides of the privacy filter, and only omits it when unset", () => {
    expect(buildDeepLinkParams({ private: true }, null)).toEqual({ private: true });
    expect(buildDeepLinkParams({ private: false }, null)).toEqual({ private: false });
    expect(buildDeepLinkParams({ private: null }, null)).toEqual({});
  });

  it("keeps both sides of the photo filter too", () => {
    expect(buildDeepLinkParams({ has_photo: true }, null)).toEqual({ has_photo: true });
    expect(buildDeepLinkParams({ has_photo: false }, null)).toEqual({ has_photo: false });
    expect(buildDeepLinkParams({ has_photo: null }, null)).toEqual({});
  });
});

describe("parseDeepLinkParams", () => {
  it("returns null territory/place/species/date and hasParams=false for empty params", () => {
    expect(parseDeepLinkParams({})).toEqual({
      filters: { territory: null, place: null, species: null, date: null },
      sort: null,
      hasParams: false,
      seenMode: null,
    });
  });

  it("numberifies territory/place/species", () => {
    const { filters } = parseDeepLinkParams({
      territory: "1",
      place: "2",
      species: "3",
    });
    expect(filters).toMatchObject({ territory: 1, place: 2, species: 3 });
  });

  it("prefers year over date_time_min/max when both are present", () => {
    const { filters } = parseDeepLinkParams({
      year: "2024",
      date_time_min: "2024-01-01",
    });
    expect(filters.date).toEqual({ type: "year", year: 2024 });
  });

  it("parses YYYY-MM-DD date params into a range filter", () => {
    const { filters } = parseDeepLinkParams({
      date_time_min: "2024-01-05",
      date_time_max: "2024-02-10",
    });
    expect(filters.date).toEqual({
      type: "range",
      from: "2024-01-05",
      to: "2024-02-10",
    });
  });

  it("parses MM/DD/YYYY and DD.MM.YYYY date formats", () => {
    expect(parseDeepLinkParams({ date_time_min: "01/05/2024" }).filters.date).toEqual({
      type: "range",
      from: "2024-01-05",
      to: null,
    });
    expect(parseDeepLinkParams({ date_time_min: "05.01.2024" }).filters.date).toEqual({
      type: "range",
      from: "2024-01-05",
      to: null,
    });
  });

  it("returns null for a malformed date string", () => {
    expect(parseDeepLinkParams({ date_time_min: "2024/01" }).filters.date).toEqual({
      type: "range",
      from: null,
      to: null,
    });
  });

  describe("privacy / source / radius", () => {
    it("reads both spellings of the privacy filter", () => {
      expect(parseDeepLinkParams({ private: "true" }).filters.private).toBe(true);
      expect(parseDeepLinkParams({ private: "false" }).filters.private).toBe(false);
      expect(parseDeepLinkParams({ private: true }).filters.private).toBe(true);
    });

    it("leaves the key out entirely when the value is missing or unparsable", () => {
      expect(parseDeepLinkParams({ private: "" }).filters).not.toHaveProperty("private");
      expect(parseDeepLinkParams({ private: "yes" }).filters).not.toHaveProperty("private");
      expect(parseDeepLinkParams({}).filters).not.toHaveProperty("private");
    });

    it("reads both spellings of the photo filter, and drops an unparsable one", () => {
      expect(parseDeepLinkParams({ has_photo: "true" }).filters.has_photo).toBe(true);
      expect(parseDeepLinkParams({ has_photo: "false" }).filters.has_photo).toBe(false);
      expect(parseDeepLinkParams({ has_photo: true }).filters.has_photo).toBe(true);
      expect(parseDeepLinkParams({ has_photo: "" }).filters).not.toHaveProperty("has_photo");
      expect(parseDeepLinkParams({ has_photo: "yes" }).filters).not.toHaveProperty("has_photo");
    });

    it("accepts only the two known sources", () => {
      expect(parseDeepLinkParams({ source: "ebird" }).filters.source).toBe("ebird");
      expect(parseDeepLinkParams({ source: "dibird" }).filters.source).toBe("dibird");
      expect(parseDeepLinkParams({ source: "flickr" }).filters).not.toHaveProperty("source");
    });

    it("numberifies a positive radius and ignores anything else", () => {
      expect(parseDeepLinkParams({ radius: "25" }).filters.radius).toBe(25);
      expect(parseDeepLinkParams({ radius: "0" }).filters).not.toHaveProperty("radius");
      expect(parseDeepLinkParams({ radius: "-5" }).filters).not.toHaveProperty("radius");
      expect(parseDeepLinkParams({ radius: "abc" }).filters).not.toHaveProperty("radius");
    });

    it("counts each of them as params of their own", () => {
      // Otherwise a link carrying nothing but one of these would be treated as
      // "no filters in the URL" and the screen would restore its own instead.
      expect(parseDeepLinkParams({ private: "false" }).hasParams).toBe(true);
      expect(parseDeepLinkParams({ has_photo: "false" }).hasParams).toBe(true);
      expect(parseDeepLinkParams({ source: "ebird" }).hasParams).toBe(true);
      expect(parseDeepLinkParams({ radius: "25" }).hasParams).toBe(true);
    });
  });

  it("passes sort and seenMode through", () => {
    const result = parseDeepLinkParams({ o: "-created", seenMode: "seen" });
    expect(result.sort).toBe("-created");
    expect(result.seenMode).toBe("seen");
    expect(result.hasParams).toBe(true);
  });
});

describe("buildDeepLinkParams / parseDeepLinkParams round trip", () => {
  it("reconstructs privacy, photos, source and radius as they were shared", () => {
    const filters = {
      private: false,
      has_photo: true,
      source: "ebird" as const,
      radius: 25,
    };
    const built = buildDeepLinkParams(filters, null);

    expect(parseDeepLinkParams(built).filters).toMatchObject(filters);
  });


  it("reconstructs an equivalent range date filter for ISO input", () => {
    const filters = {
      date: {
        type: "range" as const,
        from: "2024-01-05T00:00:00.000Z",
        to: "2024-02-10T00:00:00.000Z",
      },
    };
    const built = buildDeepLinkParams(filters, "-created");
    const { filters: parsedFilters, sort } = parseDeepLinkParams(built);
    expect(parsedFilters.date).toEqual({
      type: "range",
      from: "2024-01-05",
      to: "2024-02-10",
    });
    expect(sort).toBe("-created");
  });
});
