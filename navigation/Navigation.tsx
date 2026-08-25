import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useRef } from "react";
import { Linking } from "react-native";
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
const LAUNCH_URL_KEY = "LAUNCH_URL";

/**
 * How long the launch URL is waited for before the saved stack is restored
 * anyway. `Linking.getInitialURL()` can hang on Android
 * (facebook/react-native#25675) — React Navigation races it against 150 ms for
 * exactly that reason (see useLinking.native), so waiting longer than its own
 * resolution buys nothing: past that point it has already given up on the link
 * too.
 */
const INITIAL_URL_TIMEOUT_MS = 150;

/**
 * The URL the app was cold-launched with, or null.
 *
 * Read here and not left to React Navigation because of how NavigationContainer
 * combines the two: `initialState` wins over the state resolved from the link
 * ("If this is provided, deep link or URLs won't be handled on the initial
 * render" — its own docs). Handing it the restored stack therefore swallowed
 * every cold-start deep and universal link: the app opened on whatever screen
 * the previous session had ended on. When there is a link, the saved stack is
 * skipped and the container is left to resolve it.
 */
const getLaunchUrl = async (): Promise<string | null> => {
  try {
    return await Promise.race([
      Linking.getInitialURL(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), INITIAL_URL_TIMEOUT_MS),
      ),
    ]);
  } catch {
    return null;
  }
};

/**
 * The URL this launch should actually be routed by — the launch URL, unless it
 * is the one the previous launch was already routed by.
 *
 * On Android the launch intent outlives the process: relaunching from the
 * launcher or from Recents can hand `getInitialURL()` a link that was followed
 * days ago, and following it again would throw away the saved stack for a screen
 * the person has long left. React Navigation is exposed to the same thing and
 * does not guard, but it also does not restore a stack, so there it costs
 * nothing — here it costs the whole session.
 *
 * The cost of the guard is the opposite case: the same link tapped for real on
 * two consecutive cold starts, where the second tap restores the stack instead.
 * That one is close to harmless — a stack saved from a session that started on
 * exactly this link ends up at that same screen anyway.
 */
const takeLaunchUrl = async (): Promise<string | null> => {
  const url = await getLaunchUrl();
  if (!url) return null;

  if (url === (await AsyncStorage.getItem(LAUNCH_URL_KEY))) return null;

  await AsyncStorage.setItem(LAUNCH_URL_KEY, url);
  return url;
};

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
        // A cold start from a link is not a returning session: the person asked
        // for one particular screen, and the saved stack would silently win over
        // it (see getLaunchUrl). `null` hands the container an absent
        // initialState, which is what makes it resolve the link itself.
        if (await takeLaunchUrl()) {
          setInitialState(null);
          return;
        }

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
      // An intent from a shared link needs no such guard: the person tapped the
      // link and was asked to sign in on the spot, so the funnel is the link
      // itself. They are on Welcome at that moment — which is exactly the screen
      // the guard below treats as "signed in somewhere else entirely".
      const from = lastGuestRouteRef.current?.name;
      const coldStart = from === undefined;
      const inFunnel =
        target.fromLink ||
        coldStart ||
        from === target.name ||
        AUTH_FUNNEL_SCREENS.has(from);
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
