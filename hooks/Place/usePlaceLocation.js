import { useState, useCallback, useRef } from "react";

import { cachedReverseGeocode } from "../../services/geocoding";
import { Config } from "../../constants/config";
import { useLocationUnavailable } from "../useLocationUnavailable";
import { useLocation } from "../../store/location-context";

export const normalizeCoords = (
  lngInput,
  latInput,
  precision = 4,
  preserveInput = false,
) => {
  const toNum = (v) => {
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
  const [coords, setCoords] = useState(Config.defaultCoords);
  const [roundedCoords, setRoundedCoords] = useState(Config.defaultCoords);
  const [zoom, setZoom] = useState(12);
  const [accuracy, setAccuracy] = useState(0);
  const [latText, setLatText] = useState("");
  const [lngText, setLngText] = useState("");
  const [details, setDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { permissionStatus, requestLocation } = useLocation();
  const handleLocationUnavailable = useLocationUnavailable();

  const geocodeTimeout = useRef(null);

  const rnd = (c) => Math.round(c * 100) / 100;

  const reverseGeocode = useCallback(async (lat, lng) => {
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
  }, []);

  const updateCoords = useCallback(
    ([lng, lat], options = {}) => {
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

  const useMyLocation = useCallback(async () => {
    if (permissionStatus === "denied") {
      handleLocationUnavailable();
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestLocation();
      if (result?.coords) {
        setAccuracy(result.accuracy ?? 0);
        updateCoords(result.coords);
      } else if (permissionStatus === "denied") {
        handleLocationUnavailable();
      }
    } catch (e) {
      console.warn("Failed to use location:", e);
    } finally {
      setIsLoading(false);
    }
  }, [
    permissionStatus,
    requestLocation,
    updateCoords,
    handleLocationUnavailable,
  ]);

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
    useMyLocation,
  };
};
