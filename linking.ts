import { getStateFromPath } from "@react-navigation/native";
import { AppStackParamList, AuthStackParamList } from "./types";
import { LinkingOptions, PathConfigMap } from "@react-navigation/native";
import { track } from "./services/analytics";
import { setAuthReturn } from "./services/authReturn";
import type { MinimalRoute } from "./types";
import {
  COMPARE_TABS,
  parseEnumParam,
  paramsToTaxonFilters,
  SPECIES_DETAIL_TABS,
  TERRITORY_TABS,
  TERRITORY_VIEWS,
} from "./util/taxonShareLink";

const parseString = (v: string | null): string | undefined => v || undefined;

const withFilters = (path: string) => ({
  path,
  parse: {
    territory: parseString,
    place: parseString,
    species: parseString,
    today: parseString,
    this_year: parseString,
    year: parseString,
    date_time_min: parseString,
    date_time_max: parseString,
    o: parseString,
  },
});

const withBasicFilters = (path: string) => ({
  path,
  parse: {
    territory: parseString,
    o: parseString,
  },
});

export const DEEP_LINK_PREFIXES = ["dibird://", "https://dibird.com"];

// Web paths for the taxon group pages, keyed by rank. Serves both the lists
// (/order, /family, /genus) and the detail pages (/order/<slug> etc.).
const GROUP_RANK_BY_PATH: Record<string, 2 | 3 | 4> = {
  order: 2,
  family: 3,
  genus: 4,
};

type TaxonRoute = {
  name:
    | "Taxonomy"
    | "SpeciesDetail"
    | "TaxonGroupDetail"
    | "TerritoryList"
    | "TerritoryDetail"
    | "TerritoryCompare";
  params: Record<string, unknown>;
};

// paramsToTaxonFilters always returns an object, so passing it on unchecked
// would put an empty `initialTraits` on every plain country link — enough to
// look like "the sharer cleared the filters" to a screen that seeds its state
// from it. Only send it when the URL actually carried one.
const hasTraitParams = (params: URLSearchParams): boolean =>
  Object.keys(paramsToTaxonFilters(params)).length > 0;

// Countries catalogue: the list (/territory), one country (/territory/<slug>)
// and the two-country comparison (/territory_compare/<slug>/<slug>). Kept
// apart from matchTaxonPath because these are places, not taxa, and only the
// list takes the `o` sort.
const matchTerritoryPath = (
  segments: string[],
  params: URLSearchParams,
  sort?: string,
  search?: string,
): TaxonRoute | null => {
  const [head, ...rest] = segments;

  if (head === "territory") {
    if (rest.length === 0) {
      const region = Number(params.get("region"));
      return {
        name: "TerritoryList",
        params: {
          ...(sort && { initialSort: sort }),
          ...(search && { initialSearch: search }),
          ...(params.get("region") &&
            !Number.isNaN(region) && { initialRegion: region }),
        },
      };
    }
    if (rest.length === 1) {
      const tab = parseEnumParam(params.get("tab"), TERRITORY_TABS);
      const view = parseEnumParam(params.get("view"), TERRITORY_VIEWS);
      return {
        name: "TerritoryDetail",
        params: {
          segment: rest[0],
          ...(tab && { initialTab: tab }),
          ...(view && { initialView: view }),
          ...(sort && { initialSort: sort }),
          // Only the flat species list can be filtered, but decoding is
          // harmless either way — the screen ignores them in tree mode.
          ...(hasTraitParams(params) && {
            initialTraits: paramsToTaxonFilters(params),
          }),
        },
      };
    }
    return null;
  }

  if (head === "territory_compare" && rest.length === 2) {
    const tab = parseEnumParam(params.get("tab"), COMPARE_TABS);
    return {
      name: "TerritoryCompare",
      params: {
        segment1: rest[0],
        segment2: rest[1],
        ...(tab && { initialTab: tab }),
        ...(sort && { initialSort: sort }),
        ...(search && { initialSearch: search }),
      },
    };
  }

  return null;
};

// Maps a (locale-stripped) web path to the in-app route + params. Covers the
// catalogue lists (all species, extinct, orders/families/genera), the detail
// pages (species/genus/family/order) and the countries half (see
// matchTerritoryPath). Returns null for anything else.
const matchTaxonPath = (normalizedPath: string): TaxonRoute | null => {
  const [rawPath, query = ""] = normalizedPath.split("?");
  const segments = rawPath.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  const sort = params.get("o") || undefined;
  // The catalogue's name search (see buildTaxonCatalogUrl); restored into the
  // search box via Taxonomy.initialSearch.
  const search = params.get("name") || undefined;

  const territoryRoute = matchTerritoryPath(segments, params, sort, search);
  if (territoryRoute) return territoryRoute;

  // Lists (no slug): /species, /extinct, /order, /family, /genus
  if (segments.length === 1) {
    const [head] = segments;
    if (head === "species")
      return {
        name: "Taxonomy",
        params: {
          rank: 5,
          initialTraits: paramsToTaxonFilters(params),
          ...(sort && { initialSort: sort }),
          ...(search && { initialSearch: search }),
        },
      };
    if (head === "extinct")
      return {
        name: "Taxonomy",
        params: {
          rank: 5,
          extinct: true,
          initialTraits: paramsToTaxonFilters(params),
          ...(sort && { initialSort: sort }),
          ...(search && { initialSearch: search }),
        },
      };
    // /order, /family, /genus — the same screen at three ranks. Families and
    // genera are here because app.config.js claims `/family/` and `/genus/` as
    // App Links and the site has both pages in its sitemap: without a route
    // the link opened the app onto whatever screen it had been left on, which
    // is worse than not claiming the path at all. The app never *produces*
    // such a link (taxonListSharePath only shares orders and species), so
    // these arrive from the website only.
    const listRank = GROUP_RANK_BY_PATH[head];
    if (listRank)
      return {
        name: "Taxonomy",
        params: {
          rank: listRank,
          ...(sort && { initialSort: sort }),
          ...(search && { initialSearch: search }),
        },
      };
    return null;
  }

  // Detail pages (with slug): /species/<slug>, /order|family|genus/<slug>
  if (segments.length === 2) {
    const [head, slug] = segments;
    if (head === "species") {
      const tab = parseEnumParam(params.get("tab"), SPECIES_DETAIL_TABS);
      return {
        name: "SpeciesDetail",
        params: { segment: slug, ...(tab && { initialTab: tab }) },
      };
    }
    const rank = GROUP_RANK_BY_PATH[head];
    if (rank)
      return {
        name: "TaxonGroupDetail",
        params: { segment: slug, rank, ...(sort && { initialSort: sort }) },
      };
  }

  return null;
};

// Exported for constants/__tests__/deepLinkScreens.test.ts: the list of screens
// a shared link can reach lives in constants/deepLinkScreens.ts, and the two
// must not drift apart.
export const AUTHED_SCREENS: PathConfigMap<AppStackParamList> = {
  Main: {
    screens: {
      MainScreen: "my",
    },
  },
  Profile: "my/profile",
  Settings: "my/settings",
  Stat: withFilters("my/stat"),
  Checklist: withFilters("my/checklist"),
  Places: withBasicFilters("my/place"),
  PlaceDetail: "my/place/:placeId",
  Observations: withFilters("my/observation"),
  ObservationDetail: "my/observation/:observationId",
  CommunityDetail: "my/community/:observationId",
  Diaries: withFilters("my/diary"),
  DiaryDetail: "my/diary/:diaryId",
  Rating: withFilters("users"),
  RatingsCompare: withFilters("users/compare/:profile1/:profile2"),
  UserStat: withFilters("users/stat/:profileId"),
  Privacy: "privacy",
  Terms: "terms",
};

const GUEST_SCREENS: PathConfigMap<AuthStackParamList> = {
  Welcome: { screens: { WelcomeMain: "welcome" } },
  ConfirmEmail: "accounts/confirm-email/:key",
  Login: "accounts/login",
  Signup: "accounts/signup",
  Privacy: "privacy",
  Terms: "terms",
};

/**
 * The screen a protected link asks for, resolved against the signed-in config.
 *
 * A guest gets sent to Welcome instead (that stack simply has no such screen),
 * and without this the link died there: after signing up the person landed on
 * the dashboard, with nothing left of what they had been sent. Resolving it
 * against `AUTHED_SCREENS` is what makes the target a real AppStack screen —
 * the one `services/authReturn` can restore once the navigator is recreated.
 */
const protectedLinkTarget = (normalizedPath: string): MinimalRoute | null => {
  const state = getStateFromPath(normalizedPath, { screens: AUTHED_SCREENS });
  const route = state?.routes?.[state.routes.length - 1];

  if (!route) return null;

  return { name: route.name, params: route.params };
};

const linking = (
  isAuthenticated: boolean,
): LinkingOptions<AppStackParamList | AuthStackParamList> => ({
  prefixes: DEEP_LINK_PREFIXES,

  config: {
    screens: isAuthenticated ? AUTHED_SCREENS : GUEST_SCREENS,
  },

  getStateFromPath(
    path: string,
    options?: Parameters<typeof getStateFromPath>[1],
  ) {
    const locales = ["ru"];
    const normalizedPath2 = path.startsWith("/") ? path : `/${path}`;
    const localePrefix = locales.find((l) =>
      normalizedPath2.startsWith(`/${l}/`),
    );
    const normalizedPath = localePrefix
      ? normalizedPath2.replace(`/${localePrefix}`, "")
      : normalizedPath2;

    const authPaths = ["/accounts/login", "/accounts/signup"];
    const isAuthPath = authPaths.some((p) => normalizedPath.startsWith(p));

    if (isAuthenticated && isAuthPath) {
      return {
        routes: [{ name: "Main" }],
      };
    }

    // `/users` counts as protected next to `/my`: the rating and someone's
    // statistics are shared from the app just like a diary is, and the guest
    // stack has no screen for them either. Without it those links resolved to
    // nothing at all — the app opened wherever it had been left, which reads
    // as a broken link rather than as "sign in to see this".
    const isProtected = ["/my", "/users"].some((prefix) =>
      normalizedPath.startsWith(prefix),
    );

    if (!isAuthenticated && isProtected) {
      // What the link was for outlives the bounce to Welcome: after signing in
      // `services/authReturn` puts this screen back on top of Main, so a shared
      // diary opens instead of the dashboard. Not awaited — the intent is in a
      // module variable straight away, and the sign-in cannot finish sooner
      // than the write to disk that backs the cold path.
      const target = protectedLinkTarget(normalizedPath);
      if (target) setAuthReturn(target, { fromLink: true });

      return {
        routes: [{ name: "Welcome" }],
      };
    }

    // Shared taxonomy links (catalogue lists and detail pages). The catalogue
    // is registered in both stacks (see navigation/catalogScreens.tsx), so a
    // shared link opens in the app with or without an account — otherwise
    // every link we shipped a Share button for would bounce a non-user out to
    // the website, which is exactly the traffic sharing is meant to bring in.
    // The route under it differs per stack: Main is the authed home, Welcome
    // the guest one, so Back lands somewhere that exists either way.
    const taxonRoute = matchTaxonPath(normalizedPath);
    if (taxonRoute) {
      const root = isAuthenticated ? "Main" : "Welcome";
      // The only place where it is known for sure that the user came from an
      // external link — on the screen itself it is already indistinguishable from
      // navigating in from the tree. `authed` shows how many links reach people
      // without an account: before the guest mode they all went off to the site.
      track("deep_link_opened", {
        screen: taxonRoute.name,
        authed: isAuthenticated ? "yes" : "no",
      });
      return { index: 1, routes: [{ name: root }, taxonRoute] };
    }

    const state = getStateFromPath(normalizedPath, options);

    if (!state) return state;

    const routeName = state.routes?.[0]?.name;

    if (routeName === "PlaceDetail") {
      return {
        index: 2,
        routes: [{ name: "Main" }, { name: "Places" }, state.routes[0]],
      };
    }

    if (routeName === "ObservationDetail") {
      return {
        index: 2,
        routes: [{ name: "Main" }, { name: "Observations" }, state.routes[0]],
      };
    }

    if (routeName === "CommunityDetail") {
      return {
        index: 2,
        routes: [{ name: "Main" }, { name: "Community" }, state.routes[0]],
      };
    }

    if (routeName === "DiaryDetail") {
      return {
        index: 2,
        routes: [{ name: "Main" }, { name: "Diaries" }, state.routes[0]],
      };
    }

    return state;
  },
});

export default linking;
