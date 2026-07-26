jest.mock("../helpers", () => ({
  langBaseUrl: () => "https://dibird.com",
}));

import {
  taxonFiltersToParams,
  paramsToTaxonFilters,
  buildTaxonCatalogUrl,
  buildSpeciesDetailUrl,
  buildTerritoryCompareUrl,
  buildTerritoryDetailUrl,
  parseEnumParam,
  taxonListSharePath,
  TERRITORY_VIEWS,
} from "../taxonShareLink";
import { TaxonTraitFilters } from "../../types";

const FILTERS: TaxonTraitFilters = {
  territory: 5,
  mass_min: 1000,
  habitat: ["Forest", "Marine"],
};

it("encodes numbers as strings and arrays comma-joined, dropping empties", () => {
  expect(
    taxonFiltersToParams({
      territory: 5,
      mass_min: 1000,
      mass_max: null,
      habitat: ["Forest", "Marine"],
      migration: [],
    }),
  ).toEqual({ territory: "5", mass_min: "1000", habitat: "Forest,Marine" });
});

it("round-trips filters through the query string unchanged", () => {
  const params = new URLSearchParams(taxonFiltersToParams(FILTERS));

  expect(paramsToTaxonFilters(params)).toEqual(FILTERS);
});

it("carries the IUCN categories, so a shared link opens the same list", () => {
  const params = taxonFiltersToParams({ status: ["EN", "CR (PE)"] });
  expect(params).toEqual({ status: "EN,CR (PE)" });

  expect(
    paramsToTaxonFilters(new URLSearchParams(params)),
  ).toEqual({ status: ["EN", "CR (PE)"] });
});

it("ignores unknown or malformed params", () => {
  const params = new URLSearchParams({
    territory: "abc",
    share: "1",
    o: "name",
  });

  expect(paramsToTaxonFilters(params)).toEqual({});
});

it("builds a /species/ URL with the filters as query", () => {
  const url = buildTaxonCatalogUrl("species", FILTERS);

  expect(url.startsWith("https://dibird.com/species/?")).toBe(true);
  const query = new URLSearchParams(url.split("?")[1]);
  expect(paramsToTaxonFilters(query)).toEqual(FILTERS);
});

it("drops the query entirely when nothing is filtered", () => {
  expect(buildTaxonCatalogUrl("species", {})).toBe(
    "https://dibird.com/species/",
  );
});

it("carries the sort as o and uses each list's own path", () => {
  expect(buildTaxonCatalogUrl("species", {}, "name")).toBe(
    "https://dibird.com/species/?o=name",
  );
  expect(buildTaxonCatalogUrl("extinct", {})).toBe(
    "https://dibird.com/extinct/",
  );
  expect(buildTaxonCatalogUrl("order", {}, "ioc_id")).toBe(
    "https://dibird.com/order/?o=ioc_id",
  );
  expect(buildTaxonCatalogUrl("extinct", { territory: 5 }, "-ioc_id")).toBe(
    "https://dibird.com/extinct/?territory=5&o=-ioc_id",
  );
});

it("carries the name search as the name param", () => {
  expect(buildTaxonCatalogUrl("species", {}, null, "duck")).toBe(
    "https://dibird.com/species/?name=duck",
  );
  expect(buildTaxonCatalogUrl("species", { territory: 5 }, "name", "duck")).toBe(
    "https://dibird.com/species/?territory=5&o=name&name=duck",
  );
  // Empty/whitespace-free empty string is dropped like the other params.
  expect(buildTaxonCatalogUrl("species", {}, null, "")).toBe(
    "https://dibird.com/species/",
  );
});

describe("detail page share links", () => {
  it("shares an untouched country page as the plain short link", () => {
    expect(
      buildTerritoryDetailUrl("austria", { tab: "species", view: "tree" }),
    ).toBe("https://dibird.com/territory/austria/");
  });

  it("carries the open tab and layout", () => {
    expect(
      buildTerritoryDetailUrl("austria", { tab: "info", view: "tree" }),
    ).toBe("https://dibird.com/territory/austria/?tab=info");
    expect(
      buildTerritoryDetailUrl("austria", { tab: "species", view: "flat" }),
    ).toBe("https://dibird.com/territory/austria/?view=flat");
  });

  it("carries sort and filters only for the list layout", () => {
    // The tree is taxonomic by definition and takes no trait filters, so a
    // link promising an order it can't honour would just mislead the reader.
    expect(
      buildTerritoryDetailUrl("austria", {
        tab: "species",
        view: "tree",
        sort: "name",
        traits: { habitat: ["Forest"] },
      }),
    ).toBe("https://dibird.com/territory/austria/");

    expect(
      buildTerritoryDetailUrl("austria", {
        tab: "species",
        view: "flat",
        sort: "name",
        traits: { habitat: ["Forest"] },
      }),
    ).toBe("https://dibird.com/territory/austria/?view=flat&habitat=Forest&o=name");
  });

  it("shares a comparison with its tab, order and search", () => {
    expect(
      buildTerritoryCompareUrl("austria", "azerbaijan", { tab: "all" }),
    ).toBe("https://dibird.com/territory_compare/austria/azerbaijan/");

    expect(
      buildTerritoryCompareUrl("austria", "azerbaijan", {
        tab: "different",
        sort: "name",
        search: "duck",
      }),
    ).toBe(
      "https://dibird.com/territory_compare/austria/azerbaijan/?tab=different&o=name&name=duck",
    );
  });

  it("shares a species page on the tab it was read from", () => {
    expect(buildSpeciesDetailUrl("mandarin-duck", "overview")).toBe(
      "https://dibird.com/species/mandarin-duck/",
    );
    expect(buildSpeciesDetailUrl("mandarin-duck", "sounds")).toBe(
      "https://dibird.com/species/mandarin-duck/?tab=sounds",
    );
  });
});

it("accepts only the values a screen can actually render", () => {
  expect(parseEnumParam("flat", TERRITORY_VIEWS)).toBe("flat");
  expect(parseEnumParam("sideways", TERRITORY_VIEWS)).toBeUndefined();
  expect(parseEnumParam(null, TERRITORY_VIEWS)).toBeUndefined();
  expect(parseEnumParam("", TERRITORY_VIEWS)).toBeUndefined();
});

it("maps only the flat roots to a shareable path", () => {
  expect(taxonListSharePath(2)).toBe("order");
  expect(taxonListSharePath(5)).toBe("species");
  expect(taxonListSharePath(5, true)).toBe("extinct");
  expect(taxonListSharePath(3)).toBeNull();
  expect(taxonListSharePath(4)).toBeNull();
});
