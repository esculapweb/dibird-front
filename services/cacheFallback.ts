import * as Sentry from "@sentry/react-native";

import { AppError } from "../types";
import { isConnected } from "./sync/networkStatus";

// Каждый фетчер в util/fetches.ts построен по схеме «try — живой запрос,
// catch — отдать кэш», и этот catch ловит вообще всё: и обрыв связи, и 500,
// и 404. Для пользователя это правильный offline-first дизайн, но для нас
// он же и маскирует серверные регрессии: пока у части пользователей есть
// кэш, поломка выглядит «плавающей». Здесь мы отделяем штатный офлайн (о
// нём в Sentry сообщать нечего) от случаев, когда кэш подменил собой
// реальный ответ сервера.

export type FallbackReason =
  // Сети нет — кэш работает ровно так, как задумано.
  | "offline"
  // Сеть есть, но HTTP-ответа не случилось: таймаут, DNS, сервер лёг.
  | "unreachable"
  // Сервер ответил 5xx.
  | "server"
  // Сервер ответил 4xx (кроме «сущности больше нет», см. assertNotGone).
  | "client";

export const classifyFallback = (e: unknown): FallbackReason => {
  const status = (e as AppError | undefined)?.status;

  // status проставляется только когда был HTTP-ответ: normalizeApiError
  // для no-response отдаёт TIMEOUT/NETWORK_ERROR без него (см.
  // services/errors.ts). В RN обрыв связи почти всегда приезжает как
  // TIMEOUT, поэтому опираться на isNetworkError нельзя.
  if (status === undefined || status === 0) {
    return isConnected() ? "unreachable" : "offline";
  }

  return status >= 500 ? "server" : "client";
};

/**
 * Помечает в Sentry, что ошибку скрыл кэш, и возвращает данные как есть.
 * Молчит только при штатном офлайне — иначе каждый запуск без сети
 * заваливал бы Sentry десятками событий, в которых тонут настоящие 5xx.
 */
export const serveFromCache = <T>(value: T, e: unknown, source: string): T => {
  const reason = classifyFallback(e);
  if (reason === "offline") return value;

  const status = (e as AppError | undefined)?.status;

  Sentry.captureMessage(
    `Cache fallback masked ${status ?? "no response"} in ${source}`,
    {
      level: "warning",
      tags: {
        degraded_read: "true",
        source,
        fallback_reason: reason,
        http_status: String(status ?? 0),
      },
    },
  );

  return value;
};

/**
 * Общая форма всех читающих фетчеров: живой запрос, а на ошибке — кэш.
 * Плюс к этому ветка «сети нет и ответ уже лежит локально» — тогда запрос
 * не отправляется вовсе.
 *
 * Ветка нужна потому, что офлайн-запрос НЕ падает сразу: сокет висит до
 * `timeout: 10000` из services/api.ts (замерено на Android-эмуляторе в
 * airplane mode — запрос падал через 10.1 с, после чего чтение кэша
 * занимало 11 мс). Всё это время экран стоит на спиннере, хотя показывать
 * уже есть что.
 *
 * Только когда данные есть: если кэш пуст, запрос уходит в сеть как
 * обычно. isConnected() опирается на NetInfo, а тот умеет ошибаться
 * (reachability-проба не прошла, хотя наш API доступен) — потерять 10 с на
 * таймаут дешевле, чем показать ошибку там, где данные реально можно было
 * получить.
 *
 * @param readCache должен вернуть null, если показывать нечего (пустой
 *   массив — это «нечего», а не «пустой ответ сервера»)
 * @param onRequestError хук под assertNotGone: выполняется до чтения кэша,
 *   чтобы 404/410 улетал наружу, а не подменялся кэшем
 */
export const cachedRead = async <T>(
  source: string,
  readCache: () => T | null,
  request: () => Promise<T>,
  onRequestError?: (e: unknown) => void,
): Promise<T> => {
  if (!isConnected()) {
    const offline = readCache();
    // e === undefined: до запроса дело не дошло, ошибки нет. classifyFallback
    // без status и без сети даёт "offline", то есть в Sentry, как и при
    // пойманной офлайн-ошибке, ничего не летит.
    if (offline !== null) return serveFromCache(offline, undefined, source);
  }

  try {
    return await request();
  } catch (e) {
    onRequestError?.(e);
    const cached = readCache();
    if (cached !== null) return serveFromCache(cached, e, source);
    throw e;
  }
};

/**
 * Пробрасывает 404/410 дальше вместо отдачи кэша: сущности на сервере
 * больше нет, и кэш будет показывать её бесконечно.
 *
 * Вызывать ТОЛЬКО там, куда не может прийти negative temp id локально
 * созданной сущности (Place/Observation/Diary) — для них 404 от сервера
 * штатен, и фолбэк на репозиторий это единственный способ открыть запись.
 */
export const assertNotGone = (e: unknown): void => {
  const status = (e as AppError | undefined)?.status;
  if (status === 404 || status === 410) throw e;
};
