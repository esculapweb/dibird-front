// ProfileProvider inlines its own reconnect/app-foreground wiring (rather
// than a reusable hook like useDiarySync/useObservationSync/usePlaceSync/
// useNotificationSync — see hooks/__tests__/syncHooks.test.tsx), and fires
// both profileSync and avatarSync together. Everything not relevant to that
// wiring (the real drizzle db, live queries, analytics) is stubbed out so
// this test can focus on the reconnect/foreground behavior itself.
jest.mock("drizzle-orm/expo-sqlite", () => ({
  useLiveQuery: jest.fn(() => ({ data: [], updatedAt: 0 })),
}));

jest.mock("../../services/db/client", () => {
  // db.select().from(...).limit(1) etc. just needs to not throw — the actual
  // query result is irrelevant since useLiveQuery itself is mocked above.
  const chainable: unknown = new Proxy(
    {},
    { get: () => () => chainable },
  );
  return { db: chainable, sqliteDb: {}, runMigrations: jest.fn(async () => {}) };
});

jest.mock("../../hooks/repositories/profileRepository", () => ({
  rowToProfile: jest.fn(() => null),
  clearProfile: jest.fn(),
  applyLocalPatch: jest.fn(),
  retryMutation: jest.fn(),
  discardMutation: jest.fn(),
}));

jest.mock("../../services/sync/profileSync", () => ({
  runProfileSync: jest.fn(async () => {}),
}));
jest.mock("../../services/sync/avatarSync", () => ({
  runAvatarSync: jest.fn(async () => {}),
}));
jest.mock("../../services/sync/networkStatus", () => {
  let listeners: Array<() => void> = [];
  return {
    subscribeToReconnect: jest.fn((cb: () => void) => {
      listeners.push(cb);
      return () => {
        listeners = listeners.filter((l) => l !== cb);
      };
    }),
    __emitReconnect: () => listeners.forEach((l) => l()),
    __resetReconnectListeners: () => {
      listeners = [];
    },
  };
});
jest.mock("../../util/storageHelper", () => ({
  initGlobalFilters: jest.fn(async () => {}),
}));
jest.mock("../../services/errors", () => ({
  logError: jest.fn(),
}));
jest.mock("@react-native-firebase/analytics", () => ({
  getAnalytics: jest.fn(() => ({})),
  setUserId: jest.fn(async () => {}),
}));

import { AppState } from "react-native";
import { render } from "@testing-library/react-native";
import { ProfileProvider } from "../profile-context";
import { runProfileSync } from "../../services/sync/profileSync";
import { runAvatarSync } from "../../services/sync/avatarSync";

const networkStatusMock = require("../../services/sync/networkStatus") as {
  __emitReconnect: () => void;
  __resetReconnectListeners: () => void;
};

let appStateListeners: Array<(state: string) => void> = [];
const emitAppState = (state: string) => appStateListeners.forEach((l) => l(state));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  networkStatusMock.__resetReconnectListeners();
  appStateListeners = [];
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, cb) => {
    appStateListeners.push(cb as (state: string) => void);
    return {
      remove: jest.fn(() => {
        appStateListeners = appStateListeners.filter((l) => l !== cb);
      }),
    } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

const renderProvider = () =>
  render(
    <ProfileProvider isAuthenticated isInitializing={false}>
      <></>
    </ProfileProvider>,
  );

it("runs both profile and avatar sync together on reconnect", async () => {
  await renderProvider();
  (runProfileSync as jest.Mock).mockClear();
  (runAvatarSync as jest.Mock).mockClear();

  networkStatusMock.__emitReconnect();

  expect(runProfileSync).toHaveBeenCalledTimes(1);
  expect(runAvatarSync).toHaveBeenCalledTimes(1);
});

it("runs both again on app foreground after being backgrounded for more than 10 seconds", async () => {
  await renderProvider();
  (runProfileSync as jest.Mock).mockClear();
  (runAvatarSync as jest.Mock).mockClear();

  jest.advanceTimersByTime(11_000);
  emitAppState("background");
  emitAppState("active");
  jest.advanceTimersByTime(500);

  expect(runProfileSync).toHaveBeenCalledTimes(1);
  expect(runAvatarSync).toHaveBeenCalledTimes(1);
});

it("does not re-run on a quick background/foreground flicker under the 10 second threshold", async () => {
  await renderProvider();
  (runProfileSync as jest.Mock).mockClear();
  (runAvatarSync as jest.Mock).mockClear();

  jest.advanceTimersByTime(2_000);
  emitAppState("background");
  emitAppState("active");
  jest.advanceTimersByTime(500);

  expect(runProfileSync).not.toHaveBeenCalled();
  expect(runAvatarSync).not.toHaveBeenCalled();
});
