import { useState, useCallback } from "react";
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

  const updateCoords = useCallback(
    async ([lng, lat], { withGeocode = true } = {}) => {
      setCoords([lng, lat]);

      try {
        if (withGeocode) {
          setIsLoading(true);
          const res = await cachedReverseGeocode(lat, lng);
          if (res) setDetails(res);
        }
      } catch (e) {
        console.warn("Reverse geocode failed", e);
      } finally {
        if (withGeocode) setIsLoading(false);
      }
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
      updateCoords([loc.coords.longitude, loc.coords.latitude], {
        withGeocode: false,
      });
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
    setZoom,
    updateCoords,
    useMyLocation,
  };
};
