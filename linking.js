import { getStateFromPath } from "@react-navigation/native";

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
      Stat: "my/stat",
      Places: "my/place",
      PlaceDetail: "my/place/:placeId",
      Observations: "my/observation",
      ObservationDetail: "my/observation/:observationId",
      Diaries: "my/diary",
      DiaryDetail: "my/diary/:diaryId",

      // AuthDrawer
      Login: "accounts/login",
      Signup: "accounts/signup",
    },
  },

  getStateFromPath(path, options) {
    const locales = ["ru"];
    const localePrefix = locales.find((l) => path.startsWith(`/${l}/`));
    const normalizedPath = localePrefix
      ? path.replace(`/${localePrefix}/`, "/")
      : path;

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
