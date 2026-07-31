jest.mock("../../services/analytics", () => ({ track: jest.fn() }));
jest.mock("../../util/storageHelper", () => ({
  isOnboardingPending: jest.fn(),
  markOnboardingPending: jest.fn(),
  clearOnboardingPending: jest.fn(),
}));

import { ReactNode } from "react";
import { act, render, renderHook, waitFor } from "@testing-library/react-native";

import { track } from "../../services/analytics";
import {
  isOnboardingPending,
  markOnboardingPending,
  clearOnboardingPending,
} from "../../util/storageHelper";
import { OnboardingProvider, useOnboarding } from "../onboarding-context";

const mockIsPending = isOnboardingPending as jest.Mock;
const mockMarkPending = markOnboardingPending as jest.Mock;
const mockClearPending = clearOnboardingPending as jest.Mock;

const wrapper =
  (props: { isAuthenticated: boolean; isInitializing?: boolean }) =>
  ({ children }: { children: ReactNode }) => (
    <OnboardingProvider
      isAuthenticated={props.isAuthenticated}
      isInitializing={props.isInitializing ?? false}
    >
      {children}
    </OnboardingProvider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockIsPending.mockResolvedValue(true);
  mockMarkPending.mockResolvedValue(undefined);
  mockClearPending.mockResolvedValue(undefined);
});

describe("initial status", () => {
  it("asks for onboarding when a sign-up left the flag behind", async () => {
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });

    await waitFor(() => expect(result.current.status).toBe("needed"));
  });

  // The gate is built on "the signup has just happened" rather than on "the
  // onboarding has already been seen": by the absence of the second flag a
  // veteran who reinstalled the app and signed into an old account is
  // indistinguishable from a newcomer.
  it("leaves an account without the flag alone", async () => {
    mockIsPending.mockResolvedValue(false);

    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
  });

  // A guest has no onboarding: there is nowhere to write the country and nothing
  // to create an observation with. It matters that this is "done" and not
  // "loading" — on "loading" AppStack renders null, and signing in would hang on
  // an empty screen.
  it("resolves to done for a guest without touching the flag", async () => {
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: false }),
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(mockIsPending).not.toHaveBeenCalled();
  });

  // While the token is being restored isAuthenticated is still false — a decision
  // based on it would be made on data that is not ready.
  it("waits for auth to settle before deciding", async () => {
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: false, isInitializing: true }),
    });

    expect(result.current.status).toBe("loading");
    expect(mockIsPending).not.toHaveBeenCalled();
  });
});

// A regression: a guest signs in through Google. `Navigation` mounts AppStack in
// the same render in which isAuthenticated became true, and the root of the stack
// is chosen by the status seen in that render. While the transition to `loading`
// lived in an effect, the stack managed to see the guest `done`, came up with
// Main as the root, and the `needed` that arrived next no longer navigated
// anywhere — the newcomer stayed on the dashboard.
describe("signing in from a guest session", () => {
  it("never shows a resolved status in the render that mounts the stack", async () => {
    const seen: string[] = [];
    const Probe = () => {
      const { status } = useOnboarding();
      seen.push(status);
      return null;
    };

    const { rerender } = await render(
      <OnboardingProvider isAuthenticated={false} isInitializing={false}>
        <Probe />
      </OnboardingProvider>,
    );

    await waitFor(() => expect(seen.at(-1)).toBe("done"));
    const beforeLogin = seen.length;

    await rerender(
      <OnboardingProvider isAuthenticated={true} isInitializing={false}>
        <Probe />
      </OnboardingProvider>,
    );

    // The first thing the stack sees after the sign-in is "still reading from
    // disk", not "not needed".
    expect(seen[beforeLogin]).toBe("loading");
    expect(seen.slice(beforeLogin)).not.toContain("done");
    await waitFor(() => expect(seen.at(-1)).toBe("needed"));
  });

  it("still settles on done when the account has no pending flag", async () => {
    mockIsPending.mockResolvedValue(false);

    const seen: string[] = [];
    const Probe = () => {
      const { status } = useOnboarding();
      seen.push(status);
      return null;
    };

    const { rerender } = await render(
      <OnboardingProvider isAuthenticated={false} isInitializing={false}>
        <Probe />
      </OnboardingProvider>,
    );
    await waitFor(() => expect(seen.at(-1)).toBe("done"));

    await rerender(
      <OnboardingProvider isAuthenticated={true} isInitializing={false}>
        <Probe />
      </OnboardingProvider>,
    );

    await waitFor(() => expect(seen.at(-1)).toBe("done"));
  });
});

describe("finishing", () => {
  it("clears the flag and reports completion", async () => {
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });
    await waitFor(() => expect(result.current.status).toBe("needed"));

    await act(async () => {
      await result.current.complete();
    });

    expect(mockClearPending).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("onboarding_completed");
    expect(result.current.status).toBe("done");
  });

  it("reports the step the user walked away from", async () => {
    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });
    await waitFor(() => expect(result.current.status).toBe("needed"));

    await act(async () => {
      await result.current.skip(3);
    });

    expect(track).toHaveBeenCalledWith("onboarding_skipped", { step: 3 });
    expect(track).not.toHaveBeenCalledWith("onboarding_completed");
    expect(result.current.status).toBe("done");
  });

  // The order matters: the screen is removed from the navigator by the change of
  // status, and if the process is killed between clearing the flag and the
  // switch, it is better not to show the onboarding again than to show it on top
  // of an already created observation.
  it("clears the flag before it lets the screen go", async () => {
    let releaseWrite = () => {};
    mockClearPending.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseWrite = resolve;
      }),
    );

    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });
    await waitFor(() => expect(result.current.status).toBe("needed"));

    let finished = false;
    await act(async () => {
      result.current.complete().then(() => {
        finished = true;
      });
    });

    expect(result.current.status).toBe("needed");
    expect(finished).toBe(false);

    await act(async () => {
      releaseWrite();
    });

    await waitFor(() => expect(result.current.status).toBe("done"));
  });
});

// The debug row in Settings is the only way to see the flow on an account that
// has already passed it: the real flag is only set by sign_up.
describe("replaying it from the debug row", () => {
  it("puts the screen back and marks the flag so a restart keeps it", async () => {
    mockIsPending.mockResolvedValue(false);

    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });
    await waitFor(() => expect(result.current.status).toBe("done"));

    await act(async () => {
      await result.current.restart();
    });

    expect(mockMarkPending).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("needed");
    // A debug replay must not land in the funnel as a completion or a drop-off.
    expect(track).not.toHaveBeenCalled();
  });

  it("finishes the replayed flow the same way, clearing the flag", async () => {
    mockIsPending.mockResolvedValue(false);

    const { result } = await renderHook(() => useOnboarding(), {
      wrapper: wrapper({ isAuthenticated: true }),
    });
    await waitFor(() => expect(result.current.status).toBe("done"));

    await act(async () => {
      await result.current.restart();
    });
    await act(async () => {
      await result.current.complete();
    });

    expect(mockClearPending).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("done");
  });
});
