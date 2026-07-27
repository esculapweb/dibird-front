import AsyncStorage from "@react-native-async-storage/async-storage";

import { CATALOG_SCREEN_NAMES } from "../constants/catalogScreens";
import type { MinimalRoute } from "../types";

/**
 * Куда вернуть гостя после того, как он завёл аккаунт прямо со страницы
 * справочника (шторка `useRequireAuth`).
 *
 * Логин переключает `Navigation` с `AuthStack` на `AppStack` — навигатор
 * пересоздаётся с нуля, и без этого пользователь оказывался на MainScreen, а
 * не на птице, ради которой регистрировался. Не параметр навигации: путь может
 * пройти через экран Login (вход по почте), и промежуточный экран не должен
 * ничего про это знать.
 *
 * Хранится только имя экрана и его параметры — состояние на момент, когда
 * гость упёрся в стену.
 *
 * **Почему это ещё и в AsyncStorage.** Регистрация по почте уводит из
 * приложения: `CheckEmail` → почтовый клиент → ссылка из письма → деп-линк
 * `accounts/confirm-email/:key` → `ConfirmEmail` → `Login`. К моменту возврата
 * процесс, скорее всего, уже убит, и модульная переменная вместе с ним, —
 * то есть именно на самом длинном пути возврат и не работал. Вход через
 * Apple/Google приложение не покидает, там хватает и переменной, поэтому она
 * остаётся синхронным кэшем: горячий путь не ждёт диска.
 */
let pendingReturn: MinimalRoute | null = null;

const CARRY_OVER = new Set<string>(CATALOG_SCREEN_NAMES);

const STORAGE_KEY = "auth_return";

/**
 * Сутки. Достаточно на самый медленный путь (письмо могут открыть вечером), но
 * не настолько много, чтобы через неделю выкинуть человека на птицу, о которой
 * он уже забыл: неожиданный переход хуже отсутствующего.
 */
const TTL_MS = 24 * 60 * 60 * 1000;

type StoredReturn = MinimalRoute & { savedAt: number };

const isStoredReturn = (raw: unknown): raw is StoredReturn =>
  !!raw &&
  typeof raw === "object" &&
  typeof (raw as StoredReturn).name === "string" &&
  typeof (raw as StoredReturn).savedAt === "number";

/**
 * Запомнить экран. Экраны не из справочника игнорируются: в `AppStack` их
 * нет, восстанавливать нечего.
 */
export const setAuthReturn = async (route: MinimalRoute | null): Promise<void> => {
  const next = route && CARRY_OVER.has(route.name) ? route : null;
  pendingReturn = next;

  try {
    if (!next) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...next, savedAt: Date.now() } satisfies StoredReturn),
    );
  } catch (e) {
    // Не критично: тёплый путь (Apple/Google в шторке) обслуживается
    // переменной выше и без диска.
    if (__DEV__) console.warn(`Failed to save ${STORAGE_KEY}`, e);
  }
};

/**
 * Забрать и забыть. Вызывается на любой смене аутентификации, в том числе на
 * логауте, — чтобы намерение не пережило ситуацию, для которой ставилось.
 */
export const takeAuthReturn = async (): Promise<MinimalRoute | null> => {
  const inMemory = pendingReturn;
  pendingReturn = null;

  let stored: MinimalRoute | null = null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    await AsyncStorage.removeItem(STORAGE_KEY);

    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (
      isStoredReturn(parsed) &&
      CARRY_OVER.has(parsed.name) &&
      Date.now() - parsed.savedAt < TTL_MS
    ) {
      stored = { name: parsed.name, params: parsed.params };
    }
  } catch (e) {
    if (__DEV__) console.warn(`Failed to load ${STORAGE_KEY}`, e);
  }

  return inMemory ?? stored;
};
