import { createRef } from "react";
import {
  NavigationContainerRef,
  CommonActions,
  type NavigationAction,
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
      CommonActions.navigate(screen as string, params),
    );

  if (navigationRef.current?.isReady()) {
    go();
  } else {
    pendingNavigation = go;
  }
}

export function flushPendingNavigation() {
  if (pendingNavigation) {
    pendingNavigation?.();
    pendingNavigation = null;
  }
}

/**
 * Каждые 100 мс, до двух секунд. Ожидание тут — это одно чтение AsyncStorage
 * плюс рендер, то есть десятки миллисекунд; потолок стоит на случай, когда
 * навигатора не будет вовсе, чтобы действие не висело в таймерах до конца
 * сессии.
 */
const READY_RETRY_MS = 100;
const READY_MAX_ATTEMPTS = 20;

/**
 * Отправить действие, дождавшись навигатора.
 *
 * Навигатор бывает не смонтирован уже ПОСЛЕ того, как контейнер однажды стал
 * готов: `AppStack` рендерит `null`, пока `OnboardingProvider` перечитывает
 * свой флаг (см. navigation/AppStack.tsx), а перечитывает он его ровно на
 * входе в аккаунт. Действие, отправленное в этот зазор, пропадает — в dev с
 * красным «The 'navigation' object hasn't been initialized yet», в проде
 * молча. Ловилось на `.maestro/guest-login-return.yaml`: гость входил из
 * шторки на странице птицы, `reset` из services/authReturn улетал в никуда, и
 * вместо птицы человек оставался на дашборде — то есть ломалось ровно то,
 * ради чего authReturn и написан.
 *
 * `flushPendingNavigation` эту дыру не закрывает: он висит на `onReady`
 * контейнера, а тот к этому моменту уже отработал на гостевом стеке и второй
 * раз не позовётся.
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
