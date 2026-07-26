import { CATALOG_SCREEN_NAMES } from "../constants/catalogScreens";
import type { MinimalRoute } from "../types";

/**
 * Куда вернуть гостя после того, как он завёл аккаунт прямо со страницы
 * справочника (шторка `useRequireAuth`).
 *
 * Логин переключает `Navigation` с `AuthStack` на `AppStack` — навигатор
 * пересоздаётся с нуля, и без этого пользователь оказывался на MainScreen, а
 * не на птице, ради которой регистрировался. Модульная переменная, а не
 * параметр навигации: путь может пройти через экран Login (вход по почте), и
 * промежуточный экран не должен ничего про это знать.
 *
 * Хранится только имя экрана и его параметры — состояние на момент, когда
 * гость упёрся в стену.
 */
let pendingReturn: MinimalRoute | null = null;

const CARRY_OVER = new Set<string>(CATALOG_SCREEN_NAMES);

/**
 * Запомнить экран. Экраны не из справочника игнорируются: в `AppStack` их
 * нет, восстанавливать нечего.
 */
export const setAuthReturn = (route: MinimalRoute | null) => {
  pendingReturn = route && CARRY_OVER.has(route.name) ? route : null;
};

/**
 * Забрать и забыть. Вызывается на любой смене аутентификации, в том числе на
 * логауте, — чтобы намерение не пережило ситуацию, для которой ставилось.
 */
export const takeAuthReturn = (): MinimalRoute | null => {
  const route = pendingReturn;
  pendingReturn = null;
  return route;
};
