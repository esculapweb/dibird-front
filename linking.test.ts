jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

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

// The catalogue is registered in the guest stack too, so a shared link has to
// open in the app without an account — that is the whole point of the Share
// buttons. Only the route it sits under changes, since the guest stack has no
// Main: Back must land on Welcome instead.
it("deep-links the catalogue when signed out, rooted at Welcome", () => {
  const state = stateFor("/species/?territory=5", false);

  expect(state?.routes[0]).toEqual({ name: "Welcome" });
  expect(state?.routes[1]).toEqual({
    name: "Taxonomy",
    params: { rank: 5, initialTraits: { territory: 5 } },
  });
});

it("roots the same catalogue link at Main when signed in", () => {
  const state = stateFor("/species/osprey/", true);

  expect(state?.routes[0]).toEqual({ name: "Main" });
  expect(state?.routes[1]).toEqual({
    name: "SpeciesDetail",
    params: { segment: "osprey" },
  });
});
