import { getStateFromPath } from "@react-navigation/native";

const parseString = (v) => v || undefined;

const withFilters = (path) => ({
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

const withBasicFilters = (path) => ({
  path,
  parse: {
    territory: parseString,
    o: parseString,
  },
});

const linking = (isAuthenticated) => ({
  prefixes: ["dibird://", "https://dibird.com"],

  config: {
    screens: {
      Main: {
        screens: {
          MainDrawer: "my",
          Profile: "my/profile",
        },
      },
      Stat: withFilters("my/stat"),
      Checklist: withFilters("my/checklist"),
      Places: withBasicFilters("my/place"),
      PlaceDetail: "my/place/:placeId",
      Observations: withFilters("my/observation"),
      ObservationDetail: "my/observation/:observationId",
      Diaries: withFilters("my/diary"),
      DiaryDetail: "my/diary/:diaryId",
      Rating: withFilters("users"),
      RatingsCompare: withFilters("users/compare/:profile1/:profile2"),
      UserStat: withFilters("users/stat/:profileId"),

      // AuthDrawer
      ConfirmEmail: "accounts/confirm-email/:key",
      Login: "accounts/login",
      Signup: "accounts/signup",
    },
  },

  getStateFromPath(path, options) {
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
        routes: [{ name: "Login" }],
      };
    }

    const state = getStateFromPath(normalizedPath, options);

    if (!state) return state;

    const routeName = state.routes?.[0]?.name;

    if (routeName === "PlaceDetail") {
      return {
        routes: [{ name: "Main" }, { name: "Places" }, state.routes[0]],
      };
    }

    if (routeName === "ObservationDetail") {
      return {
        routes: [{ name: "Main" }, { name: "Observations" }, state.routes[0]],
      };
    }

    if (routeName === "DiaryDetail") {
      return {
        routes: [{ name: "Main" }, { name: "Diaries" }, state.routes[0]],
      };
    }

    return state;
  },
});

export default linking;
