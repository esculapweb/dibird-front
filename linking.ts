import { getStateFromPath } from "@react-navigation/native";
import { AppStackParamList, AuthStackParamList } from "./types";
import { LinkingOptions } from "@react-navigation/native";

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

const linking = (
  isAuthenticated: boolean,
): LinkingOptions<AppStackParamList | AuthStackParamList> => ({
  prefixes: DEEP_LINK_PREFIXES,

  config: {
    screens: isAuthenticated
      ? {
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
        }
      : {
          Welcome: { screens: { WelcomeMain: "welcome" } },
          ConfirmEmail: "accounts/confirm-email/:key",
          Login: "accounts/login",
          Signup: "accounts/signup",
          Privacy: "privacy",
          Terms: "terms",
        },
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

    const isProtected = normalizedPath.startsWith("/my");

    if (!isAuthenticated && isProtected) {
      return {
        routes: [{ name: "Welcome" }],
      };
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
