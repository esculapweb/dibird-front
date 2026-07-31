import { TerritoryData } from "../types";
import api from "./api";

/** The format of the active windows: [start_hour, end_hour] pairs, UTC hours 0-23 */
export type ActiveHourWindow = [number, number];

export interface AlertSettings {
  id: number;

  // Location — read-only flat fields (the backend returns them via SerializerMethodField)
  location_lat: number | null;
  location_lon: number | null;
  territory_data: TerritoryData;
  radius_km: number;
  rarity_threshold: "notable" | "rare" | "uncommon";
  language: string;
  seen_mode: "year" | "alltime";
  watchlist_only: boolean;
  active_hours_utc: ActiveHourWindow[];
  max_alerts_per_day: number;
  is_enabled: boolean;
  updated_at: string; // ISO-8601
}

/**
 * Payload for PUT / PATCH.
 * The coordinates are passed as the write-only fields lat/lon,
 * not as location_lat/location_lon (those are read-only on the backend).
 */
export type AlertSettingsPatch = Partial<
  Omit<AlertSettings, "id" | "updated_at" | "location_lat" | "location_lon"> & {
    lat: number | null;
    lon: number | null;
  }
>;

const BASE = "/myapi/alert-settings/me/";

/** Get the settings of the current user (GET /myapi/alert-settings/me/) */
export const getAlertSettings = () => api.get<AlertSettings>(BASE);

/**
 * Partial update (PATCH /myapi/alert-settings/me/).
 * The preferred method: only the changed fields are sent.
 */
export const updateAlertSettings = (data: AlertSettingsPatch, sync = false) =>
  api.patch<AlertSettings>(`${BASE}${sync ? "?sync=1" : ""}`, data);
