jest.mock("./util/helpers", () => ({
  langBaseUrl: () => "https://dibird.com",
}));

import linking from "./linking";
import { getStateFromPath } from "@react-navigation/native";

type State = ReturnType<typeof getStateFromPath>;

// The app receives deep links already stripped of their `dibird://` prefix by
// React Navigation, so we feed getStateFromPath the path part only. The screen
// config must be passed as the second argument exactly like React Navigation
// does at runtime — without it the built-in resolver can't map paths like
// `my/observation/:id` to their screens and just echoes the raw segments.
const stateFor = (path: string, authed = true): State => {
  const options = linking(authed);
  return options.getStateFromPath!(path, options.config);
};

// Collect every route name appearing anywhere in the (possibly nested) state so
// a fixture can assert "this link lands on screen X" without hard-coding the
// exact wrapping (Main > Observations > ObservationDetail, etc.).
const routeNames = (state: State): string[] => {
  if (!state?.routes) return [];
  return state.routes.flatMap((r) => [
    r.name,
    ...routeNames((r as { state?: State }).state ?? undefined),
  ]);
};

// Source of truth: the backend QA page http://localhost:8000/api/page2/deep/
// (and its /ru/ variant). Kept as a committed fixture so the test runs offline
// in CI. `authed` reflects the stack a real user would be in for that link.
const SUPPORTED: Array<{ path: string; authed?: boolean; screen: string }> = [
  // Top-level authed pages
  { path: "my/", screen: "MainScreen" },
  { path: "my/profile/", screen: "Profile" },
  { path: "privacy/", screen: "Privacy" },
  { path: "terms/", screen: "Terms" },

  // Auth stack (signed out)
  { path: "accounts/login/", authed: false, screen: "Login" },
  { path: "accounts/signup/", authed: false, screen: "Signup" },
  {
    path: "accounts/confirm-email/somekey123/",
    authed: false,
    screen: "ConfirmEmail",
  },

  // Taxonomy catalogue + detail pages
  { path: "species/", screen: "Taxonomy" },
  {
    path: "species/?territory=68&habitat=Wetland&o=ioc_id",
    screen: "Taxonomy",
  },
  { path: "species/?name=duck", screen: "Taxonomy" },
  {
    path: "species/?territory=68&o=ioc_id&name=duck",
    screen: "Taxonomy",
  },
  { path: "extinct/?name=dodo", screen: "Taxonomy" },
  { path: "order/", screen: "Taxonomy" },
  { path: "order/?name=owls&o=ioc_id", screen: "Taxonomy" },
  { path: "extinct/", screen: "Taxonomy" },
  { path: "order/ducks-and-relatives/", screen: "TaxonGroupDetail" },
  { path: "order/ducks-and-relatives/?o=ioc_id", screen: "TaxonGroupDetail" },
  { path: "family/ducks-geese-swans/", screen: "TaxonGroupDetail" },
  { path: "genus/aix/", screen: "TaxonGroupDetail" },
  { path: "species/mandarin-duck/", screen: "SpeciesDetail" },

  // Observations
  { path: "my/observation/", screen: "Observations" },
  { path: "my/observation/328145/", screen: "ObservationDetail" },
  {
    path: "my/observation/?territory=68&place=5372&species=3692&year=2025&o=-date_time",
    screen: "Observations",
  },
  {
    path: "my/observation/?territory=68&place=5372",
    screen: "Observations",
  },

  // Community observations
  { path: "my/community/328637/", screen: "CommunityDetail" },

  // Places
  { path: "my/place/", screen: "Places" },
  { path: "my/place/5372/", screen: "PlaceDetail" },
  { path: "my/place/?territory=60&o=name", screen: "Places" },

  // Diaries
  { path: "my/diary/", screen: "Diaries" },
  { path: "my/diary/15014/", screen: "DiaryDetail" },
  {
    path: "my/diary/?territory=68&place=&species=&year=2025&o=-date_time",
    screen: "Diaries",
  },
  {
    path: "my/diary/15004/?species=20415&o=-date_time",
    screen: "DiaryDetail",
  },

  // Rating / user stats
  { path: "users/", screen: "Rating" },
  { path: "users/stat/2/", screen: "UserStat" },
  { path: "users/compare/1/2/", screen: "RatingsCompare" },
  { path: "users/compare/1/2/?territory=68&year=2025", screen: "RatingsCompare" },
  {
    path: "users/?territory=68&year=2026&o=-observations",
    screen: "Rating",
  },

  // Stat / checklist with filters
  { path: "my/stat/?territory=68&year=2025", screen: "Stat" },
  { path: "my/checklist/?territory=68&year=2025", screen: "Checklist" },

  // Russian-locale variants from /ru/api/page2/deep/ (the /ru/ prefix and the
  // localized slugs). The prefix must be stripped and each link must resolve to
  // the same screen as its English twin.
  { path: "ru/my/", screen: "MainScreen" },
  { path: "ru/my/profile/", screen: "Profile" },
  { path: "ru/privacy/", screen: "Privacy" },
  { path: "ru/terms/", screen: "Terms" },
  { path: "ru/accounts/login/", authed: false, screen: "Login" },
  { path: "ru/accounts/signup/", authed: false, screen: "Signup" },
  {
    path: "ru/accounts/confirm-email/somekey123/",
    authed: false,
    screen: "ConfirmEmail",
  },
  { path: "ru/species/", screen: "Taxonomy" },
  {
    path: "ru/species/?territory=68&habitat=Wetland&o=ioc_id",
    screen: "Taxonomy",
  },
  { path: "ru/species/?name=zhuravl", screen: "Taxonomy" },
  { path: "ru/order/", screen: "Taxonomy" },
  { path: "ru/extinct/", screen: "Taxonomy" },
  { path: "ru/order/zhuravleobraznye/", screen: "TaxonGroupDetail" },
  {
    path: "ru/order/zhuravleobraznye/?o=ioc_id",
    screen: "TaxonGroupDetail",
  },
  { path: "ru/family/zhuravlinye/", screen: "TaxonGroupDetail" },
  { path: "ru/genus/grus/", screen: "TaxonGroupDetail" },
  { path: "ru/species/seryj-zhuravl/", screen: "SpeciesDetail" },
  { path: "ru/my/observation/", screen: "Observations" },
  { path: "ru/my/observation/328145/", screen: "ObservationDetail" },
  {
    path: "ru/my/observation/?territory=68&place=5372",
    screen: "Observations",
  },
  { path: "ru/my/community/328637/", screen: "CommunityDetail" },
  { path: "ru/my/place/", screen: "Places" },
  { path: "ru/my/place/?territory=60&o=name", screen: "Places" },
  { path: "ru/my/diary/", screen: "Diaries" },
  { path: "ru/my/diary/15014/", screen: "DiaryDetail" },
  {
    path: "ru/my/diary/15004/?species=20415&o=-date_time",
    screen: "DiaryDetail",
  },
  { path: "ru/users/", screen: "Rating" },
  { path: "ru/users/stat/2/", screen: "UserStat" },
  { path: "ru/users/compare/1/2/?territory=68&year=2025", screen: "RatingsCompare" },
  {
    path: "ru/users/?territory=68&year=2026&o=-observations",
    screen: "Rating",
  },
  { path: "ru/my/stat/?territory=68&year=2025", screen: "Stat" },
  { path: "ru/my/checklist/?territory=68&year=2025", screen: "Checklist" },
];

// Links present on the QA page that the app deliberately does not route: no
// territory screens exist, `my/test-push` has no route, and `my/users` is a
// typo for `users` on the page. These must fall through (getStateFromPath
// returns undefined) rather than land on a wrong screen.
const UNSUPPORTED: string[] = [
  "territory/",
  "territory/austria/",
  "territory_compare/austria/azerbaijan/",
  "my/test-push/",
  // Russian-locale twins of the unsupported links above.
  "ru/territory/",
  "ru/territory/avstrija/",
  "territory_compare/avstrija/azerbajdzhan/",
  "ru/my/test-push/",
];

describe("deep links from the QA page resolve to the right screen", () => {
  it.each(SUPPORTED)(
    "$path -> $screen",
    ({ path, authed = true, screen }) => {
      const names = routeNames(stateFor(path, authed));
      expect(names).toContain(screen);
    },
  );

  it.each(UNSUPPORTED)("does not route %s", (path) => {
    expect(stateFor(path)).toBeFalsy();
  });

  // Auth-state redirects: the app never lands a signed-in user on an auth
  // screen, nor a signed-out user on a protected page.
  it("sends a signed-in user hitting an auth link to Main", () => {
    expect(routeNames(stateFor("accounts/login/", true))).toEqual(["Main"]);
  });

  it("sends a signed-out user hitting a protected link to Welcome", () => {
    expect(routeNames(stateFor("my/observation/328145/", false))).toEqual([
      "Welcome",
    ]);
  });

  // The taxonomy links carry state beyond the screen name: catalogue lists
  // restore the name search + sort + filters, and group detail pages restore
  // the sort. The routeNames check above only proves the screen; these assert
  // the params round-trip so a shared search/order actually reopens as sent.
  const leafParams = (state: State): Record<string, unknown> => {
    const routes = state?.routes ?? [];
    return (routes[routes.length - 1]?.params ?? {}) as Record<string, unknown>;
  };

  it("restores the name search on a catalogue list link", () => {
    expect(leafParams(stateFor("species/?name=duck"))).toMatchObject({
      rank: 5,
      initialSearch: "duck",
    });
  });

  it("restores filters, sort and search together", () => {
    expect(
      leafParams(stateFor("species/?territory=68&o=ioc_id&name=duck")),
    ).toMatchObject({
      rank: 5,
      initialSort: "ioc_id",
      initialSearch: "duck",
      initialTraits: { territory: 68 },
    });
  });

  it("restores the sort on a group detail link", () => {
    expect(
      leafParams(stateFor("order/ducks-and-relatives/?o=ioc_id")),
    ).toMatchObject({
      segment: "ducks-and-relatives",
      rank: 2,
      initialSort: "ioc_id",
    });
  });
});
