import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import * as Location from "expo-location";
import { Coords } from "../types";

interface LocationContextType {
  locationCoords: Coords | null;
  locationAvailable: boolean;
  permissionStatus: string | null;
  requestLocation: (accuracy?: Location.Accuracy) => Promise<{
    coords: Coords;
    accuracy: number | null;
  } | null>;
  isRequesting: boolean;
}

const LocationContext = createContext<LocationContextType | null>(null);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [locationCoords, setLocationCoords] = useState<Coords | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const requestLocation = useCallback(async (desiredAccuracy: Location.Accuracy = Location.Accuracy.Balanced) => {
    if (isRequesting) return null;
    setIsRequesting(true);

    try {
      const { status: existingStatus } =
        await Location.getForegroundPermissionsAsync();
      setPermissionStatus(existingStatus);

      if (existingStatus !== "granted") {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);
        if (status !== "granted") return null;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: desiredAccuracy,
      });

      const { latitude, longitude, accuracy } = loc.coords;
      const coords: Coords = [longitude, latitude];
      setLocationCoords(coords);

      return { coords, accuracy: accuracy ?? null };
    } catch (e) {
      if (__DEV__) console.warn("Failed to get location:", e);
      return null;
    } finally {
      setIsRequesting(false);
    }
  }, [isRequesting]);

  return (
    <LocationContext.Provider
      value={{
        locationCoords,
        locationAvailable: !!locationCoords,
        permissionStatus,
        requestLocation,
        isRequesting
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within LocationProvider");
  }
  return context;
};
