import { useState, useCallback, useRef } from "react";
import * as Location from "expo-location";
import { cachedReverseGeocode } from "../services/geocoding";
import { Config } from "../constants/config";

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
    async ([lng, lat], { withGeocode = true, fromManual = false } = {}) => {
      setCoords([lng, lat]);

      if (!fromManual) {
        setLatText(lat.toFixed(4));
        setLngText(lng.toFixed(4));
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
    [],
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
