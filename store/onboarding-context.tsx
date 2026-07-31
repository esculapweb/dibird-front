import {
  createContext,
  useState,
  useRef,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

import { track, OnboardingStep } from "../services/analytics";
import {
  isOnboardingPending,
  markOnboardingPending,
  clearOnboardingPending,
} from "../util/storageHelper";

/**
 * `loading` means the flag is still being read from disk. Telling it apart from
 * `done` is mandatory: `AppStack` declares the onboarding screen first, that is,
 * the initial route of the stack depends on this value, and `NavigationContainer`
 * reads the initial route once. There is no way to render the navigator with
 * `Main` and add the onboarding on a second render — the person would simply stay
 * on the dashboard.
 */
export type OnboardingStatus = "loading" | "needed" | "done";

interface OnboardingContextType {
  status: OnboardingStatus;
  /** Went all the way through. */
  complete: () => Promise<void>;
  /** Tapped "Skip"; the step is there to see where exactly we are losing them. */
  skip: (step: OnboardingStep) => Promise<void>;
  /**
   * Debug: bring the flow back on an account that has already passed it. The real
   * flag is only set on `sign_up`, so otherwise the onboarding cannot be looked at
   * without creating a new account. Called from a hidden row in `SettingsScreen` —
   * the same place as "Send test push", and under the same gate by profile id.
   *
   * The status changes without analytics, but the screen itself sends
   * `onboarding_step` on mount — debug runs land in the funnel, which is why the
   * gate by id matters.
   */
  restart: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const OnboardingProvider = ({
  children,
  isAuthenticated,
  isInitializing,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
  isInitializing: boolean;
}) => {
  const [status, setStatus] = useState<OnboardingStatus>("loading");
  const prevAuthRef = useRef(isAuthenticated);

  // The reset to `loading` is done right in the render rather than in the effect
  // below: on signing in `Navigation` mounts `AppStack` in the same render in
  // which `isAuthenticated` became true, while effects run afterwards. Seeing the
  // `done` left over from the guest, the stack managed to come up with `Main` as
  // the root, and the `needed` set right after only added the screen to the
  // navigator without navigating anywhere: the newcomer stayed on the dashboard
  // with the flag unset (the onboarding only came up on the next cold start). We
  // set `loading` before the stack renders — it will wait on `null`, just as on a
  // cold start.
  if (isAuthenticated !== prevAuthRef.current) {
    prevAuthRef.current = isAuthenticated;
    if (isAuthenticated && status !== "loading") setStatus("loading");
  }

  useEffect(() => {
    // The same early exit as in the profile/alert-settings contexts: while the
    // token is being restored `isAuthenticated` is still false, and the decision
    // that "a guest needs no onboarding" would be made on data that is not ready.
    if (isInitializing) return;

    if (!isAuthenticated) {
      // A guest has no onboarding: there is nowhere to write the country and
      // nothing to create an observation with. Not `loading` — otherwise
      // `AppStack` (it mounts in the same render as the sign-in) would hang on an
      // empty screen.
      setStatus("done");
      return;
    }

    let cancelled = false;
    // The flag is set by the three `sign_up` points in `util/auth.ts`, and only by
    // them. A gate on "has not seen the onboarding" would be a gate on a missing
    // key, that is, it would also cover a veteran who signed into an old account
    // after a reinstall.
    isOnboardingPending().then((pending) => {
      if (cancelled) return;
      setStatus(pending ? "needed" : "done");
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isInitializing]);

  const finish = useCallback(async () => {
    // The flag is cleared first: the screen is removed from the navigator by the
    // change of status, and if the process is killed between the two operations,
    // it is better not to show the onboarding again than to show it on top of an
    // already created observation.
    await clearOnboardingPending();
    setStatus("done");
  }, []);

  const complete = useCallback(async () => {
    track("onboarding_completed");
    await finish();
  }, [finish]);

  const skip = useCallback(
    async (step: OnboardingStep) => {
      track("onboarding_skipped", { step });
      await finish();
    },
    [finish],
  );

  const restart = useCallback(async () => {
    // The flag is set, not only the status: without it the onboarding would
    // disappear on the next restart — the effect above re-reads the disk on every
    // sign-in.
    await markOnboardingPending();
    setStatus("needed");
  }, []);

  return (
    <OnboardingContext.Provider value={{ status, complete, skip, restart }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (!context)
    throw new Error("useOnboarding must be used within OnboardingProvider");
  return context;
};
