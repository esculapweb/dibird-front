// AlertSettingsProvider inlines its own reconnect/app-foreground wiring,
// mirroring store/profile-context.tsx (see profile-context.test.tsx) except
// it drives a single sync engine (alertSettingsSync) instead of two. Only
// that wiring is under test — everything else (the real drizzle db, live
// queries, i18n) is stubbed out.
jest.mock("drizzle-orm/expo-sqlite", () => ({
  useLiveQuery: jest.fn(() => ({ data: [], updatedAt: 0 })),
}));

jest.mock("../../services/db/client", () => {
  const chainable: unknown = new Proxy({}, { get: () => () => chainable });
  return { db: chainable, sqliteDb: {}, runMigrations: jest.fn(async () => {}) };
});

jest.mock("../../hooks/repositories/alertSettingsRepository", () => ({
  rowToSettings: jest.fn(() => null),
  clearAlertSettings: jest.fn(),
  applyLocalPatch: jest.fn(),
}));

jest.mock("../../services/sync/alertSettingsSync", () => ({
  runAlertSettingsSync: jest.fn(async () => {}),
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
jest.mock("../../services/errors", () => ({
  showError: jest.fn(),
  logError: jest.fn(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { AppState } from "react-native";
import { render } from "@testing-library/react-native";
import { AlertSettingsProvider } from "../alert-settings-context";
import { runAlertSettingsSync } from "../../services/sync/alertSettingsSync";

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
    <AlertSettingsProvider isAuthenticated isInitializing={false}>
      <></>
    </AlertSettingsProvider>,
  );

it("runs alert-settings sync on reconnect", async () => {
  await renderProvider();
  (runAlertSettingsSync as jest.Mock).mockClear();

  networkStatusMock.__emitReconnect();

  expect(runAlertSettingsSync).toHaveBeenCalledTimes(1);
});

it("runs sync again on app foreground after being backgrounded for more than 10 seconds", async () => {
  await renderProvider();
  (runAlertSettingsSync as jest.Mock).mockClear();

  jest.advanceTimersByTime(11_000);
  emitAppState("background");
  emitAppState("active");
  jest.advanceTimersByTime(500);

  expect(runAlertSettingsSync).toHaveBeenCalledTimes(1);
});

it("does not re-run on a quick background/foreground flicker under the 10 second threshold", async () => {
  await renderProvider();
  (runAlertSettingsSync as jest.Mock).mockClear();

  jest.advanceTimersByTime(2_000);
  emitAppState("background");
  emitAppState("active");
  jest.advanceTimersByTime(500);

  expect(runAlertSettingsSync).not.toHaveBeenCalled();
});
