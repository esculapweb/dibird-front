jest.mock("../helpers", () => ({
  langBaseUrl: () => "https://dibird.com",
}));

import {
  taxonFiltersToParams,
  paramsToTaxonFilters,
  buildTaxonCatalogUrl,
  taxonListSharePath,
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

it("maps only the flat roots to a shareable path", () => {
  expect(taxonListSharePath(2)).toBe("order");
  expect(taxonListSharePath(5)).toBe("species");
  expect(taxonListSharePath(5, true)).toBe("extinct");
  expect(taxonListSharePath(3)).toBeNull();
  expect(taxonListSharePath(4)).toBeNull();
});
