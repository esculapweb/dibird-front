import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
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
  // Callers throughout the app share one native GPS request at a time (a
  // low-priority background fetch and an explicit high-accuracy "locate me"
  // can easily overlap). Rather than dropping the late caller's request on
  // the floor — which silently left PlaceEditor's accuracy at 0 whenever it
  // raced App.tsx's startup fetch — everyone in flight awaits the same
  // promise and gets that one fix.
  const inFlightRef = useRef<Promise<{ coords: Coords; accuracy: number | null } | null> | null>(null);

  const requestLocationOnce = useCallback(async (desiredAccuracy: Location.Accuracy) => {
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
  }, []);

  const requestLocation = useCallback(async (desiredAccuracy: Location.Accuracy = Location.Accuracy.Balanced) => {
    if (inFlightRef.current) return inFlightRef.current;

    const promise = requestLocationOnce(desiredAccuracy);
    inFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      inFlightRef.current = null;
    }
  }, [requestLocationOnce]);

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
