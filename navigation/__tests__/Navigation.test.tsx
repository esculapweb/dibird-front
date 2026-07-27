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
      // Через обёртку: фабрика мока выполняется раньше, чем инициализируется
      // сама jest.fn() ниже, и прямая ссылка захватила бы undefined.
      dispatch: (...args: unknown[]) => mockDispatch(...args),
      getCurrentRoute: () => undefined,
      isReady: () => true,
    },
  },
  flushPendingNavigation: jest.fn(),
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

// Логин пересоздаёт навигатор с нуля: без возврата гость, заведший аккаунт со
// страницы птицы, оказывался на MainScreen.
describe("returning the guest after sign-in", () => {
  // Гость на экране `screen`, затем логинится.
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

    // Main под ним, а не вместо него: «назад» должно вести туда же, куда
    // ведёт у обычного пользователя.
    expect(resetPayload()).toEqual({
      index: 1,
      routes: [
        { name: "Main" },
        { name: "SpeciesDetail", params: { segment: "osprey" } },
      ],
    });
  });

  // Вход по почте уводит на экран Login, и к моменту логина исходного экрана
  // в стеке уже нет — намерение обязано пережить этот промежуточный шаг.
  it("survives the detour through the Login screen", async () => {
    setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    await signInFrom("Login");

    expect(resetPayload()?.routes.at(-1)?.name).toBe("SpeciesDetail");
  });

  // Отменил шторку, ушёл гулять, залогинился с Welcome — телепорт на давнюю
  // страницу птицы был бы сюрпризом, а не удобством.
  it("drops a stale intent when the sign-in happened elsewhere", async () => {
    setAuthReturn({ name: "SpeciesDetail", params: { segment: "osprey" } });

    await signInFrom("WelcomeMain");

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("does nothing for a plain sign-in with no wall behind it", async () => {
    await signInFrom("WelcomeMain");

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  // Экран, которого в AppStack нет, React Navigation при reset выбросит —
  // отсеиваем такие сразу, на записи намерения.
  it("ignores a screen that only the guest stack has", async () => {
    setAuthReturn({ name: "Signup" });

    await signInFrom("Signup");

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  // Регистрация по почте уводит из приложения (CheckEmail → почтовый клиент →
  // деп-линк confirm-email), и возврат приходит холодным стартом: по гостевому
  // стеку этот процесс не ходил, `lastGuestRouteRef` пуст. Гард «не выходя из
  // воронки» здесь неприменим — его роль играет суточный TTL намерения.
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
});
