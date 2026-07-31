// jest.config.js's setupFiles path only evaluates the async-storage mock
// module without wiring it up as a replacement — see
// util/__tests__/storageHelper.test.ts's identical comment. The real
// (mocked) in-memory implementation is what we want here: these tests seed
// NAV_STATE the way a previous session would have.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, waitFor } from "@testing-library/react-native";
import type { InitialState } from "@react-navigation/native";

import Navigation from "../Navigation";
import { setAuthReturn, takeAuthReturn } from "../../services/authReturn";

const mockDispatch = jest.fn();

// Captures what Navigation hands to the container: initialState is read once,
// at mount, so it is the whole contract under test. onStateChange is kept so
// tests can play the navigation the real container would have reported.
let lastInitialState: InitialState | undefined;
let containerRenders = 0;
let emitStateChange: ((state: unknown) => void) | undefined;

jest.mock("@react-navigation/native", () => ({
  // Only the container is replaced — DefaultTheme/DarkTheme and CommonActions
  // still have to be the real ones: constants/NavigationTheme spreads the
  // themes at import time, and the reset action is asserted on below.
  ...jest.requireActual("@react-navigation/native"),
  NavigationContainer: ({
    children,
    initialState,
    onStateChange,
  }: {
    children: React.ReactNode;
    initialState?: InitialState;
    onStateChange?: (state: unknown) => void;
  }) => {
    containerRenders += 1;
    lastInitialState = initialState;
    emitStateChange = onStateChange;
    return children;
  },
}));

jest.mock("../AuthStack", () => {
  const { Text: RNText } = require("react-native");
  return () => <RNText>auth-stack</RNText>;
});
jest.mock("../AppStack", () => {
  const { Text: RNText } = require("react-native");
  return () => <RNText>app-stack</RNText>;
});
jest.mock("../../linking", () => () => ({}));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));
jest.mock("../../services/sentry", () => ({
  navigationIntegration: { registerNavigationContainer: jest.fn() },
}));
jest.mock("../../services/navigationRef", () => ({
  navigationRef: {
    current: {
      // Through a wrapper: the mock factory runs before the jest.fn() below is
      // initialised, and a direct reference would capture undefined.
      dispatch: (...args: unknown[]) => mockDispatch(...args),
      getCurrentRoute: () => undefined,
      isReady: () => true,
    },
  },
  flushPendingNavigation: jest.fn(),
  // The navigator in this mock is always ready, so the wait degenerates into the
  // dispatch itself — the delay until readiness is checked by
  // services/__tests__/navigationRef.
  dispatchWhenReady: (action: unknown) => mockDispatch(action),
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => ({ theme: "light" }),
}));

const mockAuth = {
  isAuthenticated: false,
  isInitializing: false,
};
jest.mock("../../store/auth-context", () => ({
  useAuth: () => mockAuth,
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  lastInitialState = undefined;
  containerRenders = 0;
  emitStateChange = undefined;
  setAuthReturn(null);
  mockAuth.isAuthenticated = false;
  mockAuth.isInitializing = false;
});

const seedSavedStack = (routes: { name: string; params?: object }[]) =>
  AsyncStorage.setItem("NAV_STATE", JSON.stringify(routes));

describe("Navigation state restore", () => {
  it("puts a guest's saved catalog screen under Welcome, not Main", async () => {
    // The regression: catalog screens are shared by both navigators, so a
    // guest's saved stack looks exactly like a signed-in user's. Rooting it
    // at "Main" — a screen AuthStack does not have — left the guest alone on
    // Taxonomy with no back button and no way to reach sign-up.
    await seedSavedStack([{ name: "Taxonomy", params: { rank: 5 } }]);

    await render(<Navigation />);

    await waitFor(() => expect(lastInitialState).toBeDefined());
    expect(lastInitialState).toEqual({
      index: 1,
      routes: [
        { name: "Welcome" },
        { name: "Taxonomy", params: { rank: 5 } },
      ],
    });
  });

  it("roots a signed-in user's saved stack at Main", async () => {
    mockAuth.isAuthenticated = true;
    await seedSavedStack([{ name: "ObservationDetail", params: { id: 7 } }]);

    await render(<Navigation />);

    await waitFor(() => expect(lastInitialState).toBeDefined());
    expect(lastInitialState).toEqual({
      index: 1,
      routes: [
        { name: "Main" },
        { name: "ObservationDetail", params: { id: 7 } },
      ],
    });
  });

  it("waits for auth to resolve before building the state", async () => {
    // isAuthenticated is false while the token is still being read out of
    // SecureStore (biometrics can make that take seconds). Building the root
    // from it then would hand a signed-in user the guest root — and
    // initialState is only read once, so there is no second chance.
    mockAuth.isInitializing = true;
    await seedSavedStack([{ name: "ObservationDetail" }]);

    const { queryByText } = await render(<Navigation />);

    expect(queryByText("auth-stack")).toBeNull();
    expect(queryByText("app-stack")).toBeNull();
    expect(containerRenders).toBe(0);
  });

  it("keeps the saved stack when the initial token read flips auth on", async () => {
    // The token arriving from SecureStore is not a login: wiping NAV_STATE
    // here would drop the stack of every returning user, and race the read
    // above besides.
    mockAuth.isInitializing = true;
    await seedSavedStack([{ name: "ObservationDetail" }]);

    const { rerender } = await render(<Navigation />);

    mockAuth.isInitializing = false;
    mockAuth.isAuthenticated = true;
    await rerender(<Navigation />);

    await waitFor(() => expect(lastInitialState).toBeDefined());
    expect(await AsyncStorage.getItem("NAV_STATE")).not.toBeNull();
  });

  it("drops the saved stack on a real auth change", async () => {
    mockAuth.isAuthenticated = true;
    await seedSavedStack([{ name: "ObservationDetail" }]);

    const { rerender } = await render(<Navigation />);
    await waitFor(() => expect(lastInitialState).toBeDefined());

    mockAuth.isAuthenticated = false;
    await rerender(<Navigation />);

    await waitFor(async () =>
      expect(await AsyncStorage.getItem("NAV_STATE")).toBeNull(),
    );
  });

  it("renders nothing but the navigator when no stack was saved", async () => {
    const { findByText } = await render(<Navigation />);

    expect(await findByText("auth-stack")).toBeTruthy();
    expect(lastInitialState).toBeUndefined();
  });
});

// Login recreates the navigator from scratch: without the return a guest who
// created an account from a bird page ended up on MainScreen.
describe("returning the guest after sign-in", () => {
  // The guest is on `screen`, then signs in.
  const signInFrom = async (screen: string, params?: object) => {
    const { rerender } = await render(<Navigation />);
    emitStateChange?.({ index: 0, routes: [{ name: screen, params }] });

    mockAuth.isAuthenticated = true;
    await rerender(<Navigation />);
    return rerender;
  };

  const resetPayload = () =>
    mockDispatch.mock.calls.at(-1)?.[0]?.payload as
      | { index: number; routes: { name: string; params?: object }[] }
      | undefined;

  it("puts the screen the wall was hit on back over Main", async () => {
    setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    await signInFrom("SpeciesDetail", { segment: "osprey" });

    // Main underneath it, not instead of it: "back" must lead where it leads for
    // an ordinary user.
    expect(resetPayload()).toEqual({
      index: 1,
      routes: [
        { name: "Main" },
        { name: "SpeciesDetail", params: { segment: "osprey" } },
      ],
    });
  });

  // Signing in by email leads to the Login screen, and by the time of the login
  // the original screen is no longer in the stack — the intent must survive this
  // intermediate step.
  it("survives the detour through the Login screen", async () => {
    setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    await signInFrom("Login");

    expect(resetPayload()?.routes.at(-1)?.name).toBe("SpeciesDetail");
  });

  // Dismissed the sheet, went for a walk, signed in from Welcome — a teleport to
  // a long-past bird page would be a surprise, not a convenience.
  it("drops a stale intent when the sign-in happened elsewhere", async () => {
    setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    await signInFrom("WelcomeMain");

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("does nothing for a plain sign-in with no wall behind it", async () => {
    await signInFrom("WelcomeMain");

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  // A screen AppStack does not have is dropped by React Navigation on reset —
  // such screens are filtered out right away, when the intent is stored.
  it("ignores a screen that only the guest stack has", async () => {
    setAuthReturn({ name: "Signup" });

    await signInFrom("Signup");

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  // Email signup leads out of the app (CheckEmail → mail client → confirm-email
  // deep link), and the return comes as a cold start: this process never walked
  // the guest stack, `lastGuestRouteRef` is empty. The "without leaving the
  // funnel" guard does not apply here — its role is played by the one-day TTL of
  // the intent.
  it("restores an intent that survived a process restart, with no guest route seen", async () => {
    await takeAuthReturn();
    await AsyncStorage.setItem(
      "auth_return",
      JSON.stringify({
        name: "SpeciesDetail",
        params: { segment: "osprey" },
        savedAt: Date.now(),
      }),
    );

    const { rerender } = await render(<Navigation />);
    mockAuth.isAuthenticated = true;
    await rerender(<Navigation />);

    await waitFor(() =>
      expect(resetPayload()?.routes.at(-1)).toEqual({
        name: "SpeciesDetail",
        params: { segment: "osprey" },
      }),
    );
  });

  it("forgets the intent on logout instead of firing it on the next login", async () => {
    setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    mockAuth.isAuthenticated = true;
    const { rerender } = await render(<Navigation />);
    mockAuth.isAuthenticated = false;
    await rerender(<Navigation />);
    expect(mockDispatch).not.toHaveBeenCalled();

    emitStateChange?.({
      index: 0,
      routes: [{ name: "SpeciesDetail", params: { segment: "osprey" } }],
    });
    mockAuth.isAuthenticated = true;
    await rerender(<Navigation />);

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  // A guest who created an account for a particular bird is already activated.
  // The reset above removes onboarding from the stack anyway, but with the flag
  // left unset it would come up on the next cold start — on top of a funnel the
  // person has already left.
  it("counts the onboarding as done when it returns the guest", async () => {
    await AsyncStorage.setItem("onboarding_pending", "true");
    setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    await signInFrom("SpeciesDetail", { segment: "osprey" });

    await waitFor(async () =>
      expect(await AsyncStorage.getItem("onboarding_pending")).toBeNull(),
    );
  });

  it("leaves the onboarding alone for a sign-in with no wall behind it", async () => {
    await AsyncStorage.setItem("onboarding_pending", "true");

    await signInFrom("WelcomeMain");

    expect(await AsyncStorage.getItem("onboarding_pending")).toBe("true");
  });
});

// buildInitialState always makes "Main" the root: a saved [Onboarding] would
// come back as [Main, Onboarding] — an unfinished flow on top of the dashboard,
// from which "back" leads to a half-configured account.
describe("persisting the stack", () => {
  // Saving is deferred by 300 ms (see saveTimeoutRef).
  const afterDebounce = () => new Promise((resolve) => setTimeout(resolve, 400));

  it("skips the onboarding screen", async () => {
    mockAuth.isAuthenticated = true;
    await render(<Navigation />);

    emitStateChange?.({ index: 0, routes: [{ name: "Onboarding" }] });
    await afterDebounce();

    expect(await AsyncStorage.getItem("NAV_STATE")).toBeNull();
  });

  it("still saves an ordinary screen", async () => {
    mockAuth.isAuthenticated = true;
    await render(<Navigation />);

    emitStateChange?.({ index: 0, routes: [{ name: "Observations" }] });
    await afterDebounce();

    expect(await AsyncStorage.getItem("NAV_STATE")).toBe(
      JSON.stringify([{ name: "Observations" }]),
    );
  });
});
