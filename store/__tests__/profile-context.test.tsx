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
// Real services/queryPersist.ts touches the actual AsyncStorage native
// module (unmocked here, unlike util/storageHelper.ts's tests) — stub both
// it and queryClient so this test stays focused on the account-switch
// wiring in profile-context.tsx rather than React Query internals.
jest.mock("../../services/queryClient", () => ({
  queryClient: { clear: jest.fn() },
}));
jest.mock("../../services/queryPersist", () => ({
  clearPersistedQueryCache: jest.fn(async () => {}),
}));
jest.mock("@react-native-firebase/analytics", () => ({
  getAnalytics: jest.fn(() => ({})),
  setUserId: jest.fn(async () => {}),
}));
jest.mock("../../services/analytics", () => ({
  setAnalyticsUserId: jest.fn(),
  setUserProps: jest.fn(),
}));

import { AppState, Text } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  ProfileProvider,
  registerOnProfileSaved,
  useProfile,
} from "../profile-context";
import { setAnalyticsUserId, setUserProps } from "../../services/analytics";
import { logError } from "../../services/errors";
import { AppError } from "../../types";
import { runProfileSync } from "../../services/sync/profileSync";
import { runAvatarSync } from "../../services/sync/avatarSync";
import * as profileRepository from "../../hooks/repositories/profileRepository";
import * as observationRepository from "../../hooks/repositories/observationRepository";
import * as diaryRepository from "../../hooks/repositories/diaryRepository";
import * as placeRepository from "../../hooks/repositories/placeRepository";
import {
  getLastLoggedInUserId,
  initGlobalFilters,
  setLastLoggedInUserId,
} from "../../util/storageHelper";
import { queryClient } from "../../services/queryClient";
import { clearPersistedQueryCache } from "../../services/queryPersist";

const networkStatusMock = require("../../services/sync/networkStatus") as {
  __emitReconnect: () => void;
  __resetReconnectListeners: () => void;
};

let appStateListeners: Array<(state: string) => void> = [];
const emitAppState = (state: string) => appStateListeners.forEach((l) => l(state));

// The provider runs two live queries per render, in a fixed order: the
// profile row first, the failed-mutation queue second. Feeding them by call
// parity is what lets a test set up one without the other.
const mockLiveQueries = ({
  profileRows = [] as unknown[],
  mutationRows = [] as unknown[],
  updatedAt = 0,
} = {}) => {
  let call = 0;
  (useLiveQuery as jest.Mock).mockImplementation(() =>
    call++ % 2 === 0
      ? { data: profileRows, updatedAt }
      : { data: mutationRows, updatedAt: 0 },
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // clearAllMocks leaves implementations in place, so without this a test
  // that stubs a loaded profile, a pending sync or a rejected one would leak
  // it into the ones that follow.
  mockLiveQueries();
  (profileRepository.rowToProfile as jest.Mock).mockReturnValue(null);
  (runProfileSync as jest.Mock).mockResolvedValue(undefined);
  (runAvatarSync as jest.Mock).mockResolvedValue(undefined);
  (getLastLoggedInUserId as jest.Mock).mockResolvedValue(null);
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

let ctx: ReturnType<typeof useProfile> | null = null;

const Probe = () => {
  ctx = useProfile();
  return (
    <Text>
      {`loading:${ctx.profileLoading} error:${ctx.error?.message ?? "none"} failed:${ctx.failedEdit?.message ?? "none"}`}
    </Text>
  );
};

const renderWithProbe = (
  props: Partial<React.ComponentProps<typeof ProfileProvider>> = {},
) => {
  ctx = null;
  return render(
    <ProfileProvider isAuthenticated isInitializing={false} {...props}>
      <Probe />
    </ProfileProvider>,
  );
};

const probeText = () =>
  screen.getByText(/loading:/).props.children as string;

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
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(clearPersistedQueryCache).toHaveBeenCalledTimes(1);
  });

  it("does not wipe when the same user re-authenticates (e.g. after a 401-triggered logout)", async () => {
    (getLastLoggedInUserId as jest.Mock).mockResolvedValue(99);
    mockLoadedProfile(99);

    await renderProvider();

    await waitFor(() => expect(setLastLoggedInUserId).toHaveBeenCalledWith(99));
    expect(observationRepository.clearAllLocal).not.toHaveBeenCalled();
    expect(diaryRepository.clearAllLocal).not.toHaveBeenCalled();
    expect(placeRepository.clearAllLocal).not.toHaveBeenCalled();
    expect(queryClient.clear).not.toHaveBeenCalled();
    expect(clearPersistedQueryCache).not.toHaveBeenCalled();
  });

  it("does not wipe on the very first login on a device (no last user recorded yet)", async () => {
    (getLastLoggedInUserId as jest.Mock).mockResolvedValue(null);
    mockLoadedProfile(99);

    await renderProvider();

    await waitFor(() => expect(setLastLoggedInUserId).toHaveBeenCalledWith(99));
    expect(observationRepository.clearAllLocal).not.toHaveBeenCalled();
    expect(diaryRepository.clearAllLocal).not.toHaveBeenCalled();
    expect(placeRepository.clearAllLocal).not.toHaveBeenCalled();
    expect(queryClient.clear).not.toHaveBeenCalled();
    expect(clearPersistedQueryCache).not.toHaveBeenCalled();
  });
});

describe("useProfile", () => {
  it("refuses to be used outside the provider", async () => {
    const Orphan = () => {
      useProfile();
      return null;
    };
    // React logs the thrown render error on its own; silence it so the
    // expected failure doesn't look like a broken test run.
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(render(<Orphan />)).rejects.toThrow(
      "useProfile must be used within ProfileProvider",
    );

    spy.mockRestore();
  });

  it("reports loading while an authenticated session has no profile row yet", async () => {
    // runProfileSync never settles, so initialLoadAttempted stays false and
    // the loading flag is the one the UI would actually see on a cold start.
    (runProfileSync as jest.Mock).mockReturnValue(new Promise(() => {}));

    await renderWithProbe();

    expect(probeText()).toContain("loading:true");
  });

  it("stops reporting loading once the refresh has been attempted", async () => {
    await renderWithProbe();

    await waitFor(() => expect(probeText()).toContain("loading:false"));
  });

  it("reports no loading for a guest", async () => {
    await renderWithProbe({ isAuthenticated: false });

    expect(probeText()).toContain("loading:false");
  });
});

describe("refreshProfile", () => {
  it("surfaces a failed refresh instead of throwing", async () => {
    const failure = Object.assign(new Error("network down"), {
      code: "network",
    }) as AppError;
    (runProfileSync as jest.Mock).mockRejectedValueOnce(failure);

    await renderWithProbe();

    await waitFor(() => expect(probeText()).toContain("error:network down"));
    expect(logError).toHaveBeenCalledWith(failure, "Failed to refresh profile");
  });

  it("clears a previous error on the next refresh", async () => {
    (runProfileSync as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error("network down"), { code: "network" }),
    );
    await renderWithProbe();
    await waitFor(() => expect(probeText()).toContain("error:network down"));

    await act(async () => {
      await ctx!.refreshProfile();
    });

    expect(probeText()).toContain("error:none");
  });
});

describe("updateProfile", () => {
  it("writes the patch locally before pushing it", async () => {
    await renderWithProbe();
    (runProfileSync as jest.Mock).mockClear();

    await act(async () => {
      await ctx!.updateProfile({ territory: 7 });
    });

    expect(profileRepository.applyLocalPatch).toHaveBeenCalledWith({
      territory: 7,
    });
    expect(runProfileSync).toHaveBeenCalledTimes(1);
  });
});

describe("a failed edit in the queue", () => {
  const FAILED_MUTATION = {
    id: 42,
    lastError: "server said no",
    createdAt: 1700000000,
  };

  it("is exposed with its message", async () => {
    mockLiveQueries({ mutationRows: [FAILED_MUTATION] });

    await renderWithProbe();

    expect(probeText()).toContain("failed:server said no");
    expect(ctx!.failedEdit?.createdAt).toBe(1700000000);
  });

  it("re-runs both syncs when retried", async () => {
    mockLiveQueries({ mutationRows: [FAILED_MUTATION] });
    await renderWithProbe();
    (runProfileSync as jest.Mock).mockClear();
    (runAvatarSync as jest.Mock).mockClear();

    await act(async () => {
      await ctx!.retryFailedEdit();
    });

    expect(profileRepository.retryMutation).toHaveBeenCalledWith(42);
    expect(runProfileSync).toHaveBeenCalledTimes(1);
    expect(runAvatarSync).toHaveBeenCalledTimes(1);
  });

  it("drops the queued mutation when discarded", async () => {
    mockLiveQueries({ mutationRows: [FAILED_MUTATION] });
    await renderWithProbe();

    await act(async () => {
      ctx!.discardFailedEdit();
    });

    expect(profileRepository.discardMutation).toHaveBeenCalledWith(42);
  });

  it("leaves retry and discard as no-ops when the queue is empty", async () => {
    await renderWithProbe();
    (runProfileSync as jest.Mock).mockClear();

    await act(async () => {
      await ctx!.retryFailedEdit();
      ctx!.discardFailedEdit();
    });

    expect(profileRepository.retryMutation).not.toHaveBeenCalled();
    expect(profileRepository.discardMutation).not.toHaveBeenCalled();
    expect(runProfileSync).not.toHaveBeenCalled();
  });
});

describe("sign-out", () => {
  it("wipes the profile and falls back to guest analytics", async () => {
    await renderWithProbe({ isAuthenticated: false });

    expect(profileRepository.clearProfile).toHaveBeenCalledTimes(1);
    expect(setAnalyticsUserId).toHaveBeenCalledWith(null);
    expect(setUserProps).toHaveBeenCalledWith({ guest_or_registered: "guest" });
    expect(runProfileSync).not.toHaveBeenCalled();
  });

  it("does nothing at all while auth is still initializing", async () => {
    await renderWithProbe({ isAuthenticated: false, isInitializing: true });

    expect(profileRepository.clearProfile).not.toHaveBeenCalled();
    expect(runProfileSync).not.toHaveBeenCalled();
    expect(setAnalyticsUserId).not.toHaveBeenCalled();
  });
});

describe("analytics for a loaded profile", () => {
  const loadedProfile = (territory: number | null) => {
    mockLiveQueries({ profileRows: [{}], updatedAt: Date.now() });
    (profileRepository.rowToProfile as jest.Mock).mockReturnValue({
      user: 99,
      territory,
    });
  };

  it("identifies the user and records the home territory", async () => {
    loadedProfile(12);

    await renderWithProbe();

    await waitFor(() => expect(setAnalyticsUserId).toHaveBeenCalledWith("99"));
    expect(setUserProps).toHaveBeenCalledWith({
      guest_or_registered: "registered",
      home_territory: "12",
    });
  });

  // "none" means the user never picked a home country — not that it is
  // unknown; see the comment on the effect in profile-context.tsx.
  it("records 'none' when no home territory was ever picked", async () => {
    loadedProfile(null);

    await renderWithProbe();

    await waitFor(() =>
      expect(setUserProps).toHaveBeenCalledWith({
        guest_or_registered: "registered",
        home_territory: "none",
      }),
    );
  });
});

describe("registerOnProfileSaved", () => {
  it("hands the territory to every subscriber once the profile lands", async () => {
    const subscriber = jest.fn();
    const unsubscribe = registerOnProfileSaved(subscriber);
    mockLiveQueries({ profileRows: [{}], updatedAt: Date.now() });
    (profileRepository.rowToProfile as jest.Mock).mockReturnValue({
      user: 99,
      territory: 5,
    });

    await renderWithProbe();

    await waitFor(() => expect(subscriber).toHaveBeenCalledWith(5));
    unsubscribe();
  });

  it("stops calling a subscriber that unsubscribed", async () => {
    const subscriber = jest.fn();
    registerOnProfileSaved(subscriber)();
    mockLiveQueries({ profileRows: [{}], updatedAt: Date.now() });
    (profileRepository.rowToProfile as jest.Mock).mockReturnValue({
      user: 99,
      territory: 5,
    });

    await renderWithProbe();

    await waitFor(() => expect(initGlobalFilters).toHaveBeenCalledWith(5));
    expect(subscriber).not.toHaveBeenCalled();
  });
});
