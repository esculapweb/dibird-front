import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as Location from "expo-location";

import { reverseGeocoding } from "../../util/fetches";
import { useLocationUnavailable } from "../useLocationUnavailable";
import { useLocation } from "../../store/location-context";
import { Coords, ReverseGeocode } from "../../types";

interface NormalizedCoords {
  lng: number;
  lat: number;
  lngText: string;
  latText: string;
}

interface UpdateCoordsOptions {
  fromManual?: boolean;
  latText?: string;
  lngText?: string;
  withGeocode?: boolean;
  normalizeOnSave?: boolean;
}

export const normalizeCoords = (
  lngInput: string | number | null | undefined,
  latInput: string | number | null | undefined,
  precision = 4,
  preserveInput = false,
): NormalizedCoords | null => {
  const toNum = (v: string | number | null | undefined): number => {
    if (v == null) return NaN;
    if (typeof v === "string") v = v.trim();
    return v === "" ? NaN : Number(v);
  };

  const lng = toNum(lngInput);
  const lat = toNum(latInput);

  const isValid =
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  if (!isValid) return null;

  const factor = Math.pow(10, precision);
  const roundedLng = Math.round(lng * factor) / factor;
  const roundedLat = Math.round(lat * factor) / factor;

  const lngText = preserveInput
    ? typeof lngInput === "string"
      ? lngInput
      : roundedLng.toFixed(precision)
    : roundedLng.toFixed(precision);
  const latText = preserveInput
    ? typeof latInput === "string"
      ? latInput
      : roundedLat.toFixed(precision)
    : roundedLat.toFixed(precision);

  return { lng: roundedLng, lat: roundedLat, lngText, latText };
};

export const usePlaceLocation = () => {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [roundedCoords, setRoundedCoords] = useState<Coords | null>(null);
  const [zoom, setZoom] = useState(12);
  const [accuracy, setAccuracy] = useState(0);
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");
  const [details, setDetails] = useState<ReverseGeocode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { locationCoords, permissionStatus, requestLocation } = useLocation();
  const { t } = useTranslation();
  const handleLocationUnavailable = useLocationUnavailable(t('location_unavailable_map_hint'));

  const geocodeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rnd = (c: number): number => Math.round(c * 100) / 100;

  const zoomFromAccuracy = (accuracy: number): number => {
    if (accuracy <= 20) return 17;
    if (accuracy <= 100) return 15;
    if (accuracy <= 500) return 13;
    if (accuracy <= 2000) return 12;
    if (accuracy <= 5000) return 11;
    return 10;
  };

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
    geocodeTimeout.current = setTimeout(async () => {
      try {
        setIsLoading(true);
        const res = await reverseGeocoding(lat, lng);
        if (res) setDetails(res);
      } catch (e) {
        if (__DEV__) console.warn("Reverse geocode failed", e);
      } finally {
        setIsLoading(false);
      }
    }, 400);
  }, []);

  const updateCoords = useCallback(
    ([lng, lat]: Coords, options: UpdateCoordsOptions = {}) => {
      if (lng != null && lat != null) {
        setCoords([lng, lat]);
        setRoundedCoords([rnd(lng), rnd(lat)]);
      }

      if (options.fromManual) {
        if (options.latText) setLatText(options.latText);
        if (options.lngText) setLngText(options.lngText);
      } else {
        if (lng != null) setLngText(lng.toFixed(4));
        if (lat != null) setLatText(lat.toFixed(4));
      }

      if (options.withGeocode !== false && lat != null && lng != null) {
        reverseGeocode(lat, lng);
      }
    },
    [reverseGeocode],
  );

  // Когда контекст обновляет locationCoords — синхронизируем локальный стейт
  useEffect(() => {
    if (locationCoords) {
      updateCoords(locationCoords);
    }
  }, [locationCoords]);

  const locateMe = useCallback(async () => {
    if (permissionStatus === "denied") {
      handleLocationUnavailable();
      return;
    }

    setIsLoading(true);
    try {
      // Place pinning is a one-off, precision-sensitive action (unlike the
      // app's other lightweight requestLocation() callers — distance sort,
      // the background alert-settings grab — where Balanced is plenty and
      // the extra fix time isn't worth it), so ask for a tighter GPS fix here.
      const result = await requestLocation(Location.Accuracy.High);
      if (result) {
        const acc = result.accuracy ?? 0;
        setAccuracy(acc);
        setZoom(acc > 0 ? zoomFromAccuracy(acc) : 15);
        // coords придут через useEffect выше из locationCoords
      } else if (permissionStatus === "denied") {
        handleLocationUnavailable();
      }
    } catch (e) {
      if (__DEV__) console.warn("Failed to use location:", e);
    } finally {
      setIsLoading(false);
    }
  }, [permissionStatus, requestLocation, handleLocationUnavailable]);

  return {
    coords,
    roundedCoords,
    zoom,
    accuracy,
    details,
    latText,
    setLatText,
    lngText,
    setLngText,
    isLoading,
    updateCoords,
    locateMe,
  };
};
