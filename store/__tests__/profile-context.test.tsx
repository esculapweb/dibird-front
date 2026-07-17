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
jest.mock("../../hooks/repositories/observationRepository", () => ({
  clearAllLocal: jest.fn(),
}));
jest.mock("../../hooks/repositories/diaryRepository", () => ({
  clearAllLocal: jest.fn(),
}));
jest.mock("../../hooks/repositories/placeRepository", () => ({
  clearAllLocal: jest.fn(),
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
  getLastLoggedInUserId: jest.fn(async () => null),
  setLastLoggedInUserId: jest.fn(async () => {}),
}));
jest.mock("../../services/errors", () => ({
  logError: jest.fn(),
}));
jest.mock("@react-native-firebase/analytics", () => ({
  getAnalytics: jest.fn(() => ({})),
  setUserId: jest.fn(async () => {}),
}));

import { AppState } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { ProfileProvider } from "../profile-context";
import { runProfileSync } from "../../services/sync/profileSync";
import { runAvatarSync } from "../../services/sync/avatarSync";
import * as profileRepository from "../../hooks/repositories/profileRepository";
import * as observationRepository from "../../hooks/repositories/observationRepository";
import * as diaryRepository from "../../hooks/repositories/diaryRepository";
import * as placeRepository from "../../hooks/repositories/placeRepository";
import { getLastLoggedInUserId, setLastLoggedInUserId } from "../../util/storageHelper";

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

// A different account logging in on the same device shouldn't inherit
// whatever offline observation/diary/place data the previous session left
// behind (both synced mirror rows and still-unsynced edits — see
// hooks/repositories/{observation,diary,place}Repository.ts's clearAllLocal),
// but an ordinary re-login of the *same* user (e.g. after a 401-triggered
// logout) must keep it. lastLoggedInUserId is what distinguishes the two —
// see the effect in profile-context.tsx keyed on `updatedAt`.
describe("account switch detection", () => {
  const mockLoadedProfile = (userId: number) => {
    (useLiveQuery as jest.Mock).mockReturnValue({
      data: [{}],
      updatedAt: Date.now(),
    });
    (profileRepository.rowToProfile as jest.Mock).mockReturnValue({
      user: userId,
      user_data: {
        username: "u",
        first_name: "F",
        last_name: "L",
        email: "u@example.com",
        is_active: true,
      },
      avatar: "",
      avatar_thumbnail: "",
      private: false,
      private_diary: false,
      registration_ip: "",
      timezone: "",
      territory: null,
    });
  };

  it("wipes observation/diary/place local data when a different user logs in", async () => {
    (getLastLoggedInUserId as jest.Mock).mockResolvedValue(10);
    mockLoadedProfile(99);

    await renderProvider();

    await waitFor(() => expect(setLastLoggedInUserId).toHaveBeenCalledWith(99));
    expect(observationRepository.clearAllLocal).toHaveBeenCalledTimes(1);
    expect(diaryRepository.clearAllLocal).toHaveBeenCalledTimes(1);
    expect(placeRepository.clearAllLocal).toHaveBeenCalledTimes(1);
  });

  it("does not wipe when the same user re-authenticates (e.g. after a 401-triggered logout)", async () => {
    (getLastLoggedInUserId as jest.Mock).mockResolvedValue(99);
    mockLoadedProfile(99);

    await renderProvider();

    await waitFor(() => expect(setLastLoggedInUserId).toHaveBeenCalledWith(99));
    expect(observationRepository.clearAllLocal).not.toHaveBeenCalled();
    expect(diaryRepository.clearAllLocal).not.toHaveBeenCalled();
    expect(placeRepository.clearAllLocal).not.toHaveBeenCalled();
  });

  it("does not wipe on the very first login on a device (no last user recorded yet)", async () => {
    (getLastLoggedInUserId as jest.Mock).mockResolvedValue(null);
    mockLoadedProfile(99);

    await renderProvider();

    await waitFor(() => expect(setLastLoggedInUserId).toHaveBeenCalledWith(99));
    expect(observationRepository.clearAllLocal).not.toHaveBeenCalled();
    expect(diaryRepository.clearAllLocal).not.toHaveBeenCalled();
    expect(placeRepository.clearAllLocal).not.toHaveBeenCalled();
  });
});
