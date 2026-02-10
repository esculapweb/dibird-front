import { useState, useCallback, useRef } from "react";
import * as Location from "expo-location";
import { cachedReverseGeocode } from "../services/geocoding";
import { Config } from "../constants/config";

/**
 * Нормализует координаты: округляет и возвращает тексты и числа.
 * Если хотя бы одно поле невалидно, возвращает undefined.
 */
export const normalizeCoords = (lngInput, latInput, precision = 4) => {
  const toNum = (v) => (v === "" || v == null ? NaN : Number(v));

  const lng = toNum(lngInput);
  const lat = toNum(latInput);

  const isValidLng = Number.isFinite(lng) && lng >= -180 && lng <= 180;
  const isValidLat = Number.isFinite(lat) && lat >= -90 && lat <= 90;

  const factor = Math.pow(10, precision);

  return {
    lng: isValidLng ? Math.round(lng * factor) / factor : undefined,
    lat: isValidLat ? Math.round(lat * factor) / factor : undefined,
    lngText: isValidLng
      ? (Math.round(lng * factor) / factor).toFixed(precision)
      : "",
    latText: isValidLat
      ? (Math.round(lat * factor) / factor).toFixed(precision)
      : "",
  };
};

export const usePlaceLocation = () => {
  const defaultCoords = Config.defaultCoords;

  const [coords, setCoords] = useState(defaultCoords);
  const [zoom, setZoom] = useState(12);
  const [accuracy, setAccuracy] = useState(null);
  const [details, setDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const [latText, setLatText] = useState(defaultCoords[1].toFixed(4));
  const [lngText, setLngText] = useState(defaultCoords[0].toFixed(4));

  const geocodeTimeout = useRef(null);

  const updateCoords = useCallback(
    async (
      [lngInput, latInput],
      { withGeocode = true, fromManual = false, normalizeOnSave = false } = {},
    ) => {
      const normalized = normalizeCoords(lngInput, latInput);

      if (!normalized) {
        // для частично введённых значений оставляем текст
        if (fromManual) {
          setLatText(latInput ?? "");
          setLngText(lngInput ?? "");
        }
        return;
      }

      const { lng, lat, lngText: newLngText, latText: newLatText } = normalized;

      setCoords([lng ?? coords[0], lat ?? coords[1]]);

      if (!fromManual || normalizeOnSave) {
        setLatText(newLatText);
        setLngText(newLngText);
      }

      if (!withGeocode) return;

      if (geocodeTimeout.current) clearTimeout(geocodeTimeout.current);
      geocodeTimeout.current = setTimeout(async () => {
        try {
          setIsLoading(true);
          const res = await cachedReverseGeocode(lat, lng);
          if (res) setDetails(res);
        } catch (e) {
          console.warn("Reverse geocode failed", e);
        } finally {
          setIsLoading(false);
        }
      }, 400);
    },
    [coords],
  );

  const useMyLocation = useCallback(async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setAccuracy(loc.coords.accuracy);
      setZoom(14);

      updateCoords([loc.coords.longitude, loc.coords.latitude]);
    } finally {
      setIsLoading(false);
    }
  }, [updateCoords]);

  return {
    coords,
    zoom,
    accuracy,
    details,
    isLoading,
    latText,
    lngText,
    setLatText,
    setLngText,
    setZoom,
    updateCoords,
    useMyLocation,
  };
};
