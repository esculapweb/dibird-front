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

import { AppState, Text } from "react-native";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import {
  AlertSettingsProvider,
  useAlertSettings,
} from "../alert-settings-context";
import { runAlertSettingsSync } from "../../services/sync/alertSettingsSync";
import * as alertSettingsRepository from "../../hooks/repositories/alertSettingsRepository";
import { logError, showError } from "../../services/errors";

const networkStatusMock = require("../../services/sync/networkStatus") as {
  __emitReconnect: () => void;
  __resetReconnectListeners: () => void;
};

let appStateListeners: Array<(state: string) => void> = [];
const emitAppState = (state: string) => appStateListeners.forEach((l) => l(state));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  // clearAllMocks keeps implementations, so a test that stubs a loaded row or
  // a rejected sync would otherwise leak it into the ones that follow.
  (useLiveQuery as jest.Mock).mockReturnValue({ data: [], updatedAt: 0 });
  (alertSettingsRepository.rowToSettings as jest.Mock).mockReturnValue(null);
  (runAlertSettingsSync as jest.Mock).mockResolvedValue(undefined);
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

let ctx: ReturnType<typeof useAlertSettings> | null = null;

const Probe = () => {
  ctx = useAlertSettings();
  return (
    <Text>
      {`loading:${ctx.loading} saving:${ctx.saving} error:${ctx.error ?? "none"}`}
    </Text>
  );
};

const renderWithProbe = (
  props: Partial<React.ComponentProps<typeof AlertSettingsProvider>> = {},
) => {
  ctx = null;
  return render(
    <AlertSettingsProvider isAuthenticated isInitializing={false} {...props}>
      <Probe />
    </AlertSettingsProvider>,
  );
};

const probeText = () => screen.getByText(/loading:/).props.children as string;

describe("useAlertSettings", () => {
  it("refuses to be used outside the provider", async () => {
    const Orphan = () => {
      useAlertSettings();
      return null;
    };
    // React logs the thrown render error itself; silence it so the expected
    // failure doesn't look like a broken run.
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(render(<Orphan />)).rejects.toThrow(
      "useAlertSettings must be used within AlertSettingsProvider",
    );

    spy.mockRestore();
  });

  it("exposes the mirrored settings row", async () => {
    (useLiveQuery as jest.Mock).mockReturnValue({ data: [{}], updatedAt: 1 });
    (alertSettingsRepository.rowToSettings as jest.Mock).mockReturnValue({
      is_enabled: true,
      radius_km: 25,
    });

    await renderWithProbe();

    expect(ctx!.settings).toEqual({ is_enabled: true, radius_km: 25 });
    expect(probeText()).toContain("loading:false");
  });

  it("reports loading until the first refresh has been attempted", async () => {
    (runAlertSettingsSync as jest.Mock).mockReturnValue(new Promise(() => {}));

    await renderWithProbe();

    expect(probeText()).toContain("loading:true");
  });

  it("reports no loading for a guest", async () => {
    await renderWithProbe({ isAuthenticated: false });

    expect(probeText()).toContain("loading:false");
  });
});

describe("refresh", () => {
  it("shows a load error instead of throwing", async () => {
    (runAlertSettingsSync as jest.Mock).mockRejectedValueOnce(
      new Error("offline"),
    );

    await renderWithProbe();

    await waitFor(() =>
      expect(probeText()).toContain("error:could_not_load_settings"),
    );
    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      "AlertSettings refresh",
    );
  });

  it("drops the error once it is dismissed", async () => {
    (runAlertSettingsSync as jest.Mock).mockRejectedValueOnce(
      new Error("offline"),
    );
    await renderWithProbe();
    await waitFor(() =>
      expect(probeText()).toContain("error:could_not_load_settings"),
    );

    await act(async () => {
      ctx!.clearError();
    });

    expect(probeText()).toContain("error:none");
  });
});

describe("save", () => {
  it("writes the patch locally and pushes it", async () => {
    await renderWithProbe();
    (runAlertSettingsSync as jest.Mock).mockClear();

    let result: boolean | undefined;
    await act(async () => {
      result = await ctx!.save({ is_enabled: true });
    });

    expect(result).toBe(true);
    expect(alertSettingsRepository.applyLocalPatch).toHaveBeenCalledWith(
      { is_enabled: true },
      false,
    );
    expect(runAlertSettingsSync).toHaveBeenCalledTimes(1);
    expect(probeText()).toContain("saving:false");
  });

  it("passes the sync flag through to the local patch", async () => {
    await renderWithProbe();

    await act(async () => {
      await ctx!.save({ is_enabled: false }, true);
    });

    expect(alertSettingsRepository.applyLocalPatch).toHaveBeenCalledWith(
      { is_enabled: false },
      true,
    );
  });

  it("reports a failed save through both the toast and the context", async () => {
    await renderWithProbe();
    const failure = new Error("server said no");
    (runAlertSettingsSync as jest.Mock).mockRejectedValueOnce(failure);

    let result: boolean | undefined;
    await act(async () => {
      result = await ctx!.save({ is_enabled: true });
    });

    expect(result).toBe(false);
    expect(showError).toHaveBeenCalledWith(failure);
    expect(logError).toHaveBeenCalledWith(failure, "AlertSettings save");
    expect(probeText()).toContain("error:could_not_save_settings");
    expect(probeText()).toContain("saving:false");
  });

  it("clears a previous error after a save succeeds", async () => {
    (runAlertSettingsSync as jest.Mock).mockRejectedValueOnce(
      new Error("offline"),
    );
    await renderWithProbe();
    await waitFor(() =>
      expect(probeText()).toContain("error:could_not_load_settings"),
    );

    await act(async () => {
      await ctx!.save({ is_enabled: true });
    });

    expect(probeText()).toContain("error:none");
  });
});

describe("sign-out", () => {
  it("wipes the mirrored settings", async () => {
    await renderWithProbe({ isAuthenticated: false });

    expect(alertSettingsRepository.clearAlertSettings).toHaveBeenCalledTimes(1);
    expect(runAlertSettingsSync).not.toHaveBeenCalled();
  });

  it("does nothing at all while auth is still initializing", async () => {
    await renderWithProbe({ isAuthenticated: false, isInitializing: true });

    expect(alertSettingsRepository.clearAlertSettings).not.toHaveBeenCalled();
    expect(runAlertSettingsSync).not.toHaveBeenCalled();
  });
});
