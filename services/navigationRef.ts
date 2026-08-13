import { createRef } from "react";
import {
  NavigationContainerRef,
  CommonActions,
  type NavigationAction,
} from "@react-navigation/native";
import type { AppStackParamList } from "../types";

export const navigationRef =
  createRef<NavigationContainerRef<AppStackParamList>>();

let pendingNavigation: NavigationAction | null = null;

/**
 * Go to the screen a tapped push points at.
 *
 * Two waits, because a push tap arrives at any point of the launch. On a cold
 * start there is no navigator at all yet — the splash is still up, the auth
 * token is being read — and the action is parked until `onReady`
 * (`flushPendingNavigation`), with no deadline: an app init that includes
 * migrations and a cache restore easily outlives any retry ceiling. Once there
 * is a container, the dispatch still goes through `dispatchWhenReady`, because
 * "ready" is not the end of it either — the navigator disappears for a moment
 * whenever `AppStack` re-reads the onboarding flag.
 */
export function navigateFromNotification<K extends keyof AppStackParamList>(
  screen: K,
  params: AppStackParamList[K],
): void {
  const action = CommonActions.navigate(screen as string, params);

  if (navigationRef.current?.isReady()) {
    dispatchWhenReady(action);
    return;
  }

  pendingNavigation = action;
}

export function flushPendingNavigation() {
  const action = pendingNavigation;
  pendingNavigation = null;
  if (action) dispatchWhenReady(action);
}

/**
 * Every 100 ms, up to two seconds. The wait here is one AsyncStorage read plus a
 * render, that is, tens of milliseconds; the ceiling is there for the case when
 * there will be no navigator at all, so that the action does not hang in timers
 * until the end of the session.
 */
const READY_RETRY_MS = 100;
const READY_MAX_ATTEMPTS = 20;

/**
 * Dispatch an action once the navigator is there.
 *
 * The navigator can be unmounted even AFTER the container has once become ready:
 * `AppStack` renders `null` while `OnboardingProvider` re-reads its flag (see
 * navigation/AppStack.tsx), and it re-reads it exactly on signing in. An action
 * dispatched into that gap disappears — in dev with a red "The 'navigation'
 * object hasn't been initialized yet", in production silently. Caught by
 * `.maestro/guest-login-return.yaml`: the guest signed in from the sheet on a bird
 * page, the `reset` from services/authReturn flew off into nowhere, and instead of
 * the bird the person stayed on the dashboard — that is, exactly what authReturn
 * is written for was broken.
 *
 * `flushPendingNavigation` does not close this hole: it hangs on the container's
 * `onReady`, and by that moment that one has already fired on the guest stack and
 * will not be called a second time.
 */
export function dispatchWhenReady(
  action: NavigationAction,
  attemptsLeft: number = READY_MAX_ATTEMPTS,
): void {
  if (navigationRef.current?.isReady()) {
    navigationRef.current.dispatch(action);
    return;
  }

  if (attemptsLeft <= 0) return;

  setTimeout(
    () => dispatchWhenReady(action, attemptsLeft - 1),
    READY_RETRY_MS,
  );
}
