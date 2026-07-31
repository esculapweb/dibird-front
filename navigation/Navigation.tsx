import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useRef } from "react";
import { InitialState, CommonActions } from "@react-navigation/native";
import { NavigationContainer } from "@react-navigation/native";

import { track } from "../services/analytics";
import { useAuth } from "../store/auth-context";
import AuthNavigator from "./AuthStack";
import AppNavigator from "./AppStack";
import { useTheme } from "../store/theme-context";
import {
  LightNavigationTheme,
  DarkNavigationTheme,
} from "../constants/NavigationTheme";
import linking from "../linking";
import { navigationIntegration } from "../services/sentry";
import {
  dispatchWhenReady,
  flushPendingNavigation,
  navigationRef,
} from "../services/navigationRef";
import { takeAuthReturn } from "../services/authReturn";
import { clearOnboardingPending } from "../util/storageHelper";
import type { MinimalRoute, NavState } from "../types";

const NAV_STATE_KEY = "NAV_STATE";

// The login/signup screens. Needed to tell "the guest signed in without leaving
// the funnel" from "the guest changed their mind, went for a walk and signed in
// an hour later somewhere else entirely": in the second case returning them to a
// long-past bird page is a teleport, not a convenience.
const AUTH_FUNNEL_SCREENS = new Set([
  "Login",
  "Signup",
  "CheckEmail",
  "ConfirmEmail",
]);

const extractRoutes = (state: NavState, depth = 0): MinimalRoute[] => {
  if (depth > 10) return [];
  const routes = state?.routes ?? [];
  const index = state?.index ?? routes.length - 1;
  const activeRoute = routes[index];

  if (!activeRoute) return [];

  if (activeRoute.state) {
    const nested = activeRoute.state;
    const nestedRoutes = nested?.routes ?? [];
    const isDrawer = nestedRoutes.every(
      (r) => !r.state && r.name === "MainScreen",
    );

    if (isDrawer) {
      return [{ name: activeRoute.name }];
    }

    return [
      { name: activeRoute.name },
      ...extractRoutes(activeRoute.state, depth + 1),
    ];
  }

  return [{ name: activeRoute.name, params: activeRoute.params }];
};

const buildInitialState = (
  routes: MinimalRoute[],
  isAuthenticated: boolean,
): InitialState | null => {
  const screenRoutes =
    routes[0]?.name === "Root" || routes[0]?.name === "Main"
      ? routes.slice(1)
      : routes;

  const innerRoutes = screenRoutes.map((r) => ({
    name: r.name,
    params: r.params,
  }));

  // The root comes from the actual authentication rather than being guessed from
  // the contents of the saved stack. "Welcome" used to be set only if the stack
  // contained Login/Signup/CheckEmail/ConfirmEmail, otherwise "Main"; but the
  // catalogue screens (catalogScreens) are shared by both navigators, and a guest
  // who closed the app on Taxonomy got "Main" as the root, which AuthStack does
  // not have. React Navigation drops such a route — the guest was left alone on
  // the catalogue: no "back" button, no burger, no way to reach Welcome and the
  // signup.
  const root = isAuthenticated ? "Main" : "Welcome";

  const allRoutes = [{ name: root }, ...innerRoutes];

  return {
    index: allRoutes.length - 1,
    routes: allRoutes,
  };
};

const Navigation = () => {
  const { theme } = useTheme();
  const { isAuthenticated, isInitializing } = useAuth();
  const routeNameRef = useRef<string | undefined>(undefined);
  const prevAuthRef = useRef<boolean | null>(null);
  // The last screen the guest was caught on before the login. Updated only while
  // `!isAuthenticated`, so switching the navigator does not overwrite it.
  const lastGuestRouteRef = useRef<MinimalRoute | null>(null);

  const [initialState, setInitialState] = useState<
    InitialState | null | undefined
  >(undefined);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Wait for the token to be restored (SecureStore plus possibly biometrics):
    // while that runs isAuthenticated is still false, and a root built from it
    // would be the "guest" one for a signed-in user. NavigationContainer reads
    // initialState once on mount, a second attempt fixes nothing — so until auth
    // is ready null is rendered (see the early return below) instead of guessing.
    if (isInitializing) return;

    const restore = async () => {
      try {
        const saved = await AsyncStorage.getItem(NAV_STATE_KEY);

        if (!saved) {
          setInitialState(null);
          return;
        }

        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const built = buildInitialState(parsed, isAuthenticated);
          setInitialState(built ?? null);
          return;
        }

        await AsyncStorage.removeItem(NAV_STATE_KEY);
        setInitialState(null);
      } catch {
        setInitialState(null);
      }
    };

    restore();
    // isAuthenticated is deliberately not in the dependencies: restoring is a
    // one-off, and on a change of login the stack is reset by the effect below
    // rather than re-read.
  }, [isInitializing]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    // The same early exit as in the restore: until auth is ready isAuthenticated
    // is still false, and its very first flip to true (the token was simply read
    // from SecureStore) would look like a login — the stack would be wiped on
    // every launch of a signed-in user, and racing the read above at that. The
    // initial value is captured already resolved.
    if (isInitializing) return;

    if (prevAuthRef.current === null) {
      prevAuthRef.current = isAuthenticated;
      return;
    }
    if (prevAuthRef.current === isAuthenticated) return;

    prevAuthRef.current = isAuthenticated;
    AsyncStorage.removeItem(NAV_STATE_KEY);

    // Always taken, even on a logout: the intent must not outlive the situation
    // it was set for. Asynchronously, because the intent also survives a process
    // restart (see services/authReturn.ts).
    takeAuthReturn().then((target) => {
      if (!isAuthenticated || !target) return;

      // The guest signed in from a reference page (the useRequireAuth sheet). By
      // now the navigator has already switched to AppStack and stands on
      // MainScreen — we put the screen it all started from back on top of Main,
      // so that "back" leads where it would for an ordinary user.
      //
      // The guard is there so as not to teleport someone who changed their mind,
      // went for a walk and signed in an hour later somewhere else entirely. But
      // it only works on the warm path: if the app restarted (email signup takes
      // the user to a mail client, the link brings them back on a cold start), the
      // guest never walked this stack and `lastGuestRouteRef` is empty. There the
      // "without leaving the funnel" role is played by the one-day TTL of the
      // intent itself.
      const from = lastGuestRouteRef.current?.name;
      const coldStart = from === undefined;
      const inFunnel =
        coldStart || from === target.name || AUTH_FUNNEL_SCREENS.has(from);
      if (!inFunnel) return;

      // Onboarding is over for this person before it began. They created an
      // account for a particular bird, and the reset below removes the onboarding
      // screen from the stack anyway; with the flag left unset it would come up on
      // the next cold start — on top of a funnel they have already left. Running
      // them through "pick a country" would mean taking away the very intent 1.1
      // and 1.2 were made for.
      clearOnboardingPending().catch(
        (e) => __DEV__ && console.warn("[NAV] failed to clear onboarding", e),
      );

      // Not a direct dispatch: on signing in the navigator may be missing for a
      // second — `AppStack` renders null while the onboarding flag is re-read, and
      // the reset used to be lost together with the intent (see dispatchWhenReady).
      dispatchWhenReady(
        CommonActions.reset({
          index: 1,
          routes: [
            { name: "Main" },
            { name: target.name, params: target.params },
          ],
        }),
      );
    });
  }, [isAuthenticated, isInitializing]);

  if (initialState === undefined) return null;

  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={initialState ?? undefined}
      linking={linking(isAuthenticated)}
      theme={theme === "dark" ? DarkNavigationTheme : LightNavigationTheme}
      onReady={() => {
        flushPendingNavigation();

        navigationIntegration.registerNavigationContainer(navigationRef);
        const current = navigationRef.current?.getCurrentRoute()?.name;

        routeNameRef.current = current;

        if (current) {
          track("screen_view", {
            screen_name: current,
            screen_class: current,
          });
        }
      }}
      onStateChange={async (state) => {
        if (state) {
          const routes = extractRoutes(state as NavState);
          if (!isAuthenticated) {
            lastGuestRouteRef.current = routes.at(-1) ?? null;
          }
          // Onboarding is not persisted: buildInitialState always makes "Main"
          // the root, and a saved [Onboarding] would come back as [Main,
          // Onboarding] — a flow on top of the dashboard, from which "back" leads
          // to a half-configured account. While the flag is unset the screen ends
          // up as the root of the stack anyway (see AppStack), there is nothing to
          // restore. Persistence only: the screen_view below must be sent for
          // onboarding, otherwise the whole step between sign_up and the first
          // screen would vanish from the funnel.
          if (routes.at(-1)?.name !== "Onboarding") {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
              AsyncStorage.setItem(NAV_STATE_KEY, JSON.stringify(routes)).catch(
                (e) => __DEV__ && console.warn("[NAV] failed to save state", e),
              );
            }, 300);
          }
        }

        const current = navigationRef.current?.getCurrentRoute()?.name;
        const previous = routeNameRef.current;

        if (current && previous !== current) {
          track("screen_view", {
            screen_name: current,
            screen_class: current,
          });
          routeNameRef.current = current;
        }
      }}
    >
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default Navigation;
