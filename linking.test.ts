jest.mock("./util/helpers", () => ({
  langBaseUrl: () => "https://dibird.com",
}));

import linking from "./linking";
import { getStateFromPath } from "@react-navigation/native";

type State = ReturnType<typeof getStateFromPath>;

const stateFor = (path: string, authed = true): State => {
  const options = linking(authed);
  return options.getStateFromPath!(path, undefined);
};

it("opens the catalogue with the filters from a shared /species link", () => {
  const state = stateFor("/species/?territory=5&mass_min=1000&habitat=Forest");

  expect(state).toEqual({
    index: 1,
    routes: [
      { name: "Main" },
      {
        name: "Taxonomy",
        params: {
          rank: 5,
          initialTraits: { territory: 5, mass_min: 1000, habitat: ["Forest"] },
        },
      },
    ],
  });
});

it("opens the plain catalogue when the link carries no filters", () => {
  const state = stateFor("/species/");

  expect(state?.routes[1]).toEqual({
    name: "Taxonomy",
    params: { rank: 5, initialTraits: {} },
  });
});

it("strips the ru locale prefix before matching", () => {
  const state = stateFor("/ru/species/?territory=5");

  expect(state?.routes[1]).toEqual({
    name: "Taxonomy",
    params: { rank: 5, initialTraits: { territory: 5 } },
  });
});

it("carries the sort from a shared link", () => {
  const state = stateFor("/species/?o=name");

  expect(state?.routes[1]).toEqual({
    name: "Taxonomy",
    params: { rank: 5, initialTraits: {}, initialSort: "name" },
  });
});

it("opens the extinct list", () => {
  const state = stateFor("/extinct/");

  expect(state?.routes[1]).toEqual({
    name: "Taxonomy",
    params: { rank: 5, extinct: true, initialTraits: {} },
  });
});

it("opens the orders list", () => {
  const state = stateFor("/order/");

  expect(state?.routes[1]).toEqual({ name: "Taxonomy", params: { rank: 2 } });
});

it("opens the detail pages for species and each group rank", () => {
  expect(stateFor("/species/osprey/")?.routes[1]).toEqual({
    name: "SpeciesDetail",
    params: { segment: "osprey" },
  });
  expect(stateFor("/genus/pandion/")?.routes[1]).toEqual({
    name: "TaxonGroupDetail",
    params: { segment: "pandion", rank: 4 },
  });
  expect(stateFor("/family/pandionidae/")?.routes[1]).toEqual({
    name: "TaxonGroupDetail",
    params: { segment: "pandionidae", rank: 3 },
  });
  expect(stateFor("/order/accipitriformes/")?.routes[1]).toEqual({
    name: "TaxonGroupDetail",
    params: { segment: "accipitriformes", rank: 2 },
  });
});

it("does not deep-link the catalogue when signed out", () => {
  const state = stateFor("/species/?territory=5", false);

  expect(JSON.stringify(state ?? null)).not.toContain("Taxonomy");
});
