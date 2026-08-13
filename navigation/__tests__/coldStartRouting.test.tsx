// The two ways a screen is opened from outside the app — a link (deep or
// universal) and a push tap — meet in one place: NavigationContainer. Each has
// its own resolution path, and each has already been broken by the other, so
// they are tested together, against a real container.
//
// Unlike Navigation.test.tsx, which stubs the container out and asserts the
// props handed to it, here the container is the real one with real navigators
// under it: the bugs below (initialState quietly winning over a link, a queued
// push navigation lost between "ready" and the navigator actually being there)
// live precisely in how those props are combined, and a stub cannot show them.

// jest.config.js's setupFiles path only evaluates the async-storage mock module
// without wiring it up as a replacement — same comment as in Navigation.test.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Both navigators are real (the linking config resolves to route names, and a
// stub would accept any of them), but their screens are not: the real ones drag
// in maplibre, expo-audio and the whole data layer.
const APP_SCREENS = [
  "Main",
  "Community",
  "CommunityDetail",
  "Notifications",
  "Observations",
  "ObservationDetail",
  "SpeciesDetail",
  "Taxonomy",
  "Checklist",
  "Achievements",
  "Privacy",
];
const AUTH_SCREENS = ["Welcome", "Login", "Signup", "SpeciesDetail", "Taxonomy"];

const stackOf = (names: string[]) => {
  const {
    createNativeStackNavigator,
  } = require("@react-navigation/native-stack");
  const { Text } = require("react-native");
  const Stack = createNativeStackNavigator();
  const Screen = ({ route }: { route: { name: string } }) => (
    <Text>{route.name}</Text>
  );

  return () => (
    <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      {names.map((name) => (
        <Stack.Screen key={name} name={name} component={Screen} />
      ))}
    </Stack.Navigator>
  );
};

jest.mock("../AppStack", () => stackOf(APP_SCREENS));
jest.mock("../AuthStack", () => stackOf(AUTH_SCREENS));
jest.mock("../../services/analytics", () => ({ track: jest.fn() }));
jest.mock("../../services/sentry", () => ({
  navigationIntegration: { registerNavigationContainer: jest.fn() },
}));
jest.mock("../../store/theme-context", () => ({
  useTheme: () => ({ theme: "light" }),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import { act, render } from "@testing-library/react-native";

import Navigation from "../Navigation";
import {
  navigateFromNotification,
  navigationRef,
} from "../../services/navigationRef";

const mockAuth = { isAuthenticated: true, isInitializing: false };
jest.mock("../../store/auth-context", () => ({ useAuth: () => mockAuth }));

// What the person actually ends up looking at.
const currentRoute = () => navigationRef.current?.getCurrentRoute()?.name;
// The whole stack under it — "back" has to lead somewhere that exists.
const routeNames = () =>
  (
    navigationRef.current?.getRootState()?.routes ?? []
  ).map((r: { name: string }) => r.name);

// The callback React Navigation subscribes with for links arriving at a running
// app (useLinking.native → Linking.addEventListener("url")).
let urlListener: ((event: { url: string }) => void) | undefined;

const seedSavedStack = (routes: { name: string; params?: object }[]) =>
  AsyncStorage.setItem("NAV_STATE", JSON.stringify(routes));

const launchedWith = (url: string | null) =>
  (Linking.getInitialURL as jest.Mock).mockResolvedValue(url);

// Everything here settles through promises rather than events: the launch URL,
// the AsyncStorage read, the container's own initial-state resolution.
const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  urlListener = undefined;
  mockAuth.isAuthenticated = true;
  mockAuth.isInitializing = false;

  jest.spyOn(Linking, "getInitialURL").mockResolvedValue(null);
  jest
    .spyOn(Linking, "addEventListener")
    .mockImplementation((_event, callback) => {
      urlListener = callback as (event: { url: string }) => void;
      return { remove: jest.fn() } as unknown as ReturnType<
        typeof Linking.addEventListener
      >;
    });
});

afterEach(() => {
  (navigationRef as { current: unknown }).current = null;
});

// The regression this file was written for. NavigationContainer prefers the
// `initialState` prop over the state it resolves from the launch URL ("If this
// is provided, deep link or URLs won't be handled on the initial render"), so
// restoring the previous session's stack silently swallowed every link that
// arrived on a cold start — the app opened where the last session had ended.
describe("a link that cold-launched the app", () => {
  it("wins over the restored stack (universal link)", async () => {
    await seedSavedStack([{ name: "Observations" }]);
    launchedWith("https://dibird.com/species/mandarin-duck/");

    await render(<Navigation />);
    await settle();

    expect(currentRoute()).toBe("SpeciesDetail");
    // Main underneath, so "back" from a link lands on the dashboard.
    expect(routeNames()).toEqual(["Main", "SpeciesDetail"]);
  });

  it("wins over the restored stack (dibird:// scheme)", async () => {
    await seedSavedStack([{ name: "Observations" }]);
    launchedWith("dibird://species/mandarin-duck/");

    await render(<Navigation />);
    await settle();

    expect(currentRoute()).toBe("SpeciesDetail");
  });

  it("keeps the intermediate screens a personal link needs", async () => {
    await seedSavedStack([{ name: "Checklist" }]);
    launchedWith("https://dibird.com/my/observation/7/");

    await render(<Navigation />);
    await settle();

    expect(routeNames()).toEqual(["Main", "Observations", "ObservationDetail"]);
  });

  it("carries the ru locale prefix through to the same screen", async () => {
    await seedSavedStack([{ name: "Observations" }]);
    launchedWith("https://dibird.com/ru/species/mandarin-duck/");

    await render(<Navigation />);
    await settle();

    expect(currentRoute()).toBe("SpeciesDetail");
  });

  // Catalogue links are shared with people who have no account: the guest stack
  // registers the same screens, rooted at Welcome instead of Main.
  it("opens for a guest too, under Welcome", async () => {
    mockAuth.isAuthenticated = false;
    await seedSavedStack([{ name: "Taxonomy" }]);
    launchedWith("https://dibird.com/species/mandarin-duck/");

    await render(<Navigation />);
    await settle();

    expect(currentRoute()).toBe("SpeciesDetail");
    expect(routeNames()).toEqual(["Welcome", "SpeciesDetail"]);
  });

  // The saved stack is still the point of the restore for every launch that is
  // not a link — the fix must not have turned it off.
  it("leaves the saved stack alone when there was no link", async () => {
    await seedSavedStack([{ name: "Observations" }]);

    await render(<Navigation />);
    await settle();

    expect(currentRoute()).toBe("Observations");
  });
});

// The half that already worked, kept as a guard: the fix above changes what
// initialState is handed over, and getting that wrong would break the running
// app's links instead.
describe("a link that arrives while the app is running", () => {
  it("navigates from the restored stack", async () => {
    await seedSavedStack([{ name: "Observations" }]);

    await render(<Navigation />);
    await settle();
    expect(currentRoute()).toBe("Observations");

    await act(async () => {
      urlListener?.({ url: "https://dibird.com/species/mandarin-duck/" });
    });

    expect(currentRoute()).toBe("SpeciesDetail");
  });

  it("navigates from a link that came in over the dibird:// scheme", async () => {
    await render(<Navigation />);
    await settle();

    await act(async () => {
      urlListener?.({ url: "dibird://my/observation/7/" });
    });

    expect(currentRoute()).toBe("ObservationDetail");
  });
});

describe("a push tap", () => {
  // The cold start: the tap is handled by usePushNotifications while the splash
  // is still up and there is no navigator to dispatch into. The action waits for
  // the container instead of being dropped.
  it("lands on its screen when it was handled before the navigator existed", async () => {
    await seedSavedStack([{ name: "Main" }]);
    navigateFromNotification("Community", { highlightObsIds: [1, 2] });

    await render(<Navigation />);
    await settle();

    expect(currentRoute()).toBe("Community");
    expect(navigationRef.current?.getCurrentRoute()?.params).toEqual({
      highlightObsIds: [1, 2],
    });
  });

  // The alert people actually get: one find near them. Went through the whole
  // chain — payload, switch, queue, container — and used to fall out of it at
  // the switch, leaving the person on the dashboard.
  it("opens the card of a single find from a cold start", async () => {
    await seedSavedStack([{ name: "Main" }]);
    navigateFromNotification("CommunityDetail", { observationId: 31 });

    await render(<Navigation />);
    await settle();

    expect(currentRoute()).toBe("CommunityDetail");
    expect(navigationRef.current?.getCurrentRoute()?.params).toEqual({
      observationId: 31,
    });
  });

  it("still lands when the app was cold-launched by a link at the same time", async () => {
    // A link opens the app, a push is tapped from the notification shade over
    // it: the two resolution paths must not cancel each other out.
    launchedWith("https://dibird.com/species/mandarin-duck/");
    navigateFromNotification("Notifications", undefined);

    await render(<Navigation />);
    await settle();

    expect(currentRoute()).toBe("Notifications");
    expect(routeNames()).toContain("SpeciesDetail");
  });

  // The warm case: the container is there, the dispatch goes straight through.
  it("navigates immediately when the app is already running", async () => {
    await render(<Navigation />);
    await settle();

    await act(async () => {
      navigateFromNotification("Achievements", { highlightId: "birds_100" });
    });

    expect(currentRoute()).toBe("Achievements");
  });

  it("goes to the notification list, a payload screen that had no branch", async () => {
    await render(<Navigation />);
    await settle();

    await act(async () => {
      navigateFromNotification("Notifications", undefined);
    });

    expect(currentRoute()).toBe("Notifications");
  });
});
