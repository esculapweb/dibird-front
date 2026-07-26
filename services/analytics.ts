import {
  getAnalytics,
  logEvent,
  setUserId,
  setUserProperties,
} from "@react-native-firebase/analytics";

import { logError } from "./errors";

/** Как пользователь входит/регистрируется. */
export type AuthMethod = "email" | "google" | "apple";

/** Что гость попытался сделать до того, как упёрся в шторку регистрации. */
export type GatedAction = "add_observation";

/** Что именно шарят. */
export type ShareType =
  | "species"
  | "taxon_group"
  | "taxon_list"
  | "territory"
  | "territory_list"
  | "territory_compare";

/**
 * Имена событий и их параметры. Union нужен, потому что Firebase принимает
 * любую строку: опечатка в имени не падает, а тихо создаёт второе событие, и
 * обнаруживается через сутки в консоли, когда данные уже потеряны.
 *
 * `login`, `sign_up` и `screen_view` — стандартные события Firebase, у них
 * готовые отчёты и воронки. Имена и параметр `method` менять нельзя.
 */
type EventParams = {
  login: { method: AuthMethod };
  sign_up: { method: AuthMethod };
  screen_view: { screen_name: string; screen_class: string };
  /** Первый экран приложения у незалогиненного — вершина воронки. */
  welcome_viewed: undefined;
  /** Тап по кнопке входа. Разница с `login` = отвал в провайдере. */
  auth_started: { method: AuthMethod };
  /** Гость пошёл в каталог вместо регистрации. */
  guest_browse_started: { source: "welcome" | "drawer" | "deep_link" };
  /** Гостю показали шторку «создайте аккаунт». */
  auth_wall_shown: { action: GatedAction };
  /**
   * Ссылка снаружи открылась в приложении. Отвечает на вопрос «приводит ли
   * шеринг трафик» напрямую, поэтому у `species_viewed`/`territory_viewed`
   * своего параметра «откуда» нет: определить его на самом экране нечем —
   * туда приходят и из дерева, и из поиска, и по ссылке.
   */
  deep_link_opened: { screen: string; authed: "yes" | "no" };
  species_viewed: undefined;
  territory_viewed: undefined;
  share_tapped: { type: ShareType };
  observation_created: undefined;
  /** Ключевая точка активации; шлётся один раз за установку. */
  first_observation_created: undefined;
};

export type AnalyticsEventName = keyof EventParams;

/**
 * Свойства пользователя, по которым режутся все отчёты. Firebase хранит их
 * строками, поэтому числа заранее раскладываем по корзинам — «сколько именно
 * видов» ни в одном отчёте не спросить, а «0 / 1-10 / 11-100 / 100+» отвечает
 * на вопрос «дошёл ли до ценности».
 */
export type UserProps = {
  guest_or_registered: "guest" | "registered";
  ui_language: string;
  /** Id страны из профиля или "none" — выбрал ли пользователь её вообще. */
  home_territory: string;
  has_push_token: "yes" | "no";
  lifelist_bucket: "0" | "1-10" | "11-100" | "100+";
};

export const lifelistBucket = (count: number): UserProps["lifelist_bucket"] => {
  if (count <= 0) return "0";
  if (count <= 10) return "1-10";
  if (count <= 100) return "11-100";
  return "100+";
};

// Аналитика не имеет права ломать сценарий, в который встроена: logEvent
// возвращает промис, и необработанный reject посреди логина уронил бы вход.
// Поэтому всё гасится здесь и уходит в общий logError.
const swallow = (tag: string) => (e: unknown) => logError(e, tag);

// Firebase типизирует logEvent набором перегрузок: у зарезервированных имён
// (`login`, `sign_up`, `screen_view`) свои сигнатуры, а `CustomEventName<K>`
// их, наоборот, запрещает — обобщённый параметр не подходит ни под одну.
// Наш union строже любой из них, поэтому имя отдаём как строку здесь, в
// единственной точке, а не в каждом вызывающем экране.
const send = logEvent as (
  analytics: ReturnType<typeof getAnalytics>,
  name: string,
  params?: Record<string, unknown>,
) => Promise<void>;

/**
 * Единственная точка отправки событий. У события без параметров второй
 * аргумент не принимается, у события с параметрами — обязателен.
 */
export const track = <K extends AnalyticsEventName>(
  name: K,
  ...[params]: EventParams[K] extends undefined ? [] : [EventParams[K]]
): void => {
  try {
    send(getAnalytics(), name, params ?? undefined).catch(
      swallow(`analytics:${name}`),
    );
  } catch (e) {
    logError(e, `analytics:${name}`);
  }
};

export const setUserProps = (props: Partial<UserProps>): void => {
  try {
    setUserProperties(getAnalytics(), props).catch(
      swallow("analytics:userProps"),
    );
  } catch (e) {
    logError(e, "analytics:userProps");
  }
};

/** `null` — разлогин: дальнейшие события не должны липнуть к прошлому id. */
export const setAnalyticsUserId = (userId: string | null): void => {
  try {
    setUserId(getAnalytics(), userId).catch(swallow("analytics:userId"));
  } catch (e) {
    logError(e, "analytics:userId");
  }
};
