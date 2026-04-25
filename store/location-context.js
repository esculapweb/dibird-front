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
    if (isRequestingRef.current) return null;
    isRequestingRef.current = true;
    try {
      const { status: existingStatus } =
        await Location.getForegroundPermissionsAsync();
      setPermissionStatus(existingStatus);
      if (existingStatus === "denied") return null;
      if (existingStatus !== "granted") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setPermissionStatus("denied");
          return null;
        }
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Location timeout")), 5000),
        ),
      ]);
      const { latitude, longitude, accuracy: acc } = loc.coords;
      const coords = [longitude, latitude];
      setLocationCoords(coords);
      setPermissionStatus("granted");
      return { coords, accuracy: acc }; // ← возвращаем результат
    } catch (e) {
      try {
        console.warn("Failed to get location:", e);
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          const coords = [last.coords.longitude, last.coords.latitude];
          setLocationCoords(coords);
          setPermissionStatus("granted");
          return { coords, accuracy: 0 };
        }
      } catch {}
      return null;
    } finally {
      isRequestingRef.current = false;
    }
  }, []);
  

  useEffect(() => {
    const checkExistingPermission = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status === "granted") {
        await requestLocation();
      }
    };
    checkExistingPermission();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        requestLocation();
      }
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
