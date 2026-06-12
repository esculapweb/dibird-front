// src/api/alertSettings.ts
import api from "./api";

// ─── Типы ────────────────────────────────────────────────────────────────────

/** Формат активных окон: пары [start_hour, end_hour], часы UTC 0-23 */
export type ActiveHourWindow = [number, number];

/** Данные, которые приходят с сервера (GET-ответ) */
export interface AlertSettings {
  id: number;

  // Локация — read-only плоские поля (бэк отдаёт их через SerializerMethodField)
  location_lat: number | null;
  location_lon: number | null;

  radius_km: number;
  rarity_threshold: "notable" | "rare" | "uncommon";
  watchlist_only: boolean;
  include_local_observations: boolean;
  active_hours_utc: ActiveHourWindow[];
  max_alerts_per_day: number;
  is_enabled: boolean;
  updated_at: string; // ISO-8601
}

/**
 * Payload для PUT / PATCH.
 * Координаты передаются как write-only поля lat/lon,
 * а не как location_lat/location_lon (те read-only на бэке).
 */
export type AlertSettingsPatch = Partial<
  Omit<AlertSettings, "id" | "updated_at" | "location_lat" | "location_lon"> & {
    lat: number | null;
    lon: number | null;
  }
>;

// ─── API-функции ──────────────────────────────────────────────────────────────

const BASE = "/myapi/alert-settings/me/";

/** Получить настройки текущего пользователя (GET /myapi/alert-settings/me/) */
export const getAlertSettings = () =>
  api.get<AlertSettings>(BASE);

/**
 * Полное обновление (PUT /myapi/alert-settings/me/).
 * Используется, когда нужно передать все поля целиком.
 */
export const replaceAlertSettings = (data: AlertSettingsPatch) =>
  api.put<AlertSettings>(BASE, data);

/**
 * Частичное обновление (PATCH /myapi/alert-settings/me/).
 * Предпочтительный метод: отправляем только изменившиеся поля.
 */
export const updateAlertSettings = (data: AlertSettingsPatch) =>
  api.patch<AlertSettings>(BASE, data);