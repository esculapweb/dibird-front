import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";

const LocationContext = createContext({
  locationCoords: null,
  locationAvailable: false,
  refreshLocation: () => {},
});

export const LocationProvider = ({ children }) => {
  const [locationCoords, setLocationCoords] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState(null); 
  const isRequestingRef = useRef(false);

  const requestLocation = useCallback(async () => {
    if (isRequestingRef.current) return;
    isRequestingRef.current = true;
    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(existingStatus); // "granted", "denied", "undetermined"
      if (existingStatus === "denied") return;
      if (existingStatus !== "granted") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Location timeout")), 10000),
        ),
      ]);
      const { latitude, longitude } = loc.coords;
      setLocationCoords([longitude, latitude]);
      setPermissionStatus("granted");
    } catch (e) {
      console.warn("Failed to get location:", e);
    } finally {
      isRequestingRef.current = false;
    }
  }, []);

  useEffect(() => {
    requestLocation();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") requestLocation();
    });

    return () => subscription.remove();
  }, []);

  return (
    <LocationContext.Provider
      value={{
        locationCoords,
        locationAvailable: !!locationCoords,
        permissionStatus,
        refreshLocation: requestLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationCoords = () => useContext(LocationContext);
