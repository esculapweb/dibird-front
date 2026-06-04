import { createRef } from "react";
import {
  NavigationContainerRef,
  CommonActions,
} from "@react-navigation/native";
import type { AppStackParamList } from "../types";

export const navigationRef =
  createRef<NavigationContainerRef<AppStackParamList>>();

let pendingNavigation: (() => void) | null = null;

export function navigateFromNotification<K extends keyof AppStackParamList>(
  screen: K,
  params: AppStackParamList[K],
): void {
  const go = () =>
    navigationRef.current?.dispatch(
      CommonActions.navigate({ name: screen as string, params }),
    );

  if (navigationRef.current?.isReady()) {
    go();
  } else {
    pendingNavigation = go; // выполнить когда станет готов
  }
}

export function flushPendingNavigation() {
  pendingNavigation?.();
  pendingNavigation = null;
}
