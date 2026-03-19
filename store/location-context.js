import { createContext, useContext, useState, useEffect } from "react";
import * as Location from "expo-location";

const LocationContext = createContext({ locationCoords: null, locationAvailable: false });

export const LocationProvider = ({ children }) => {
  const [locationCoords, setLocationCoords] = useState(null);

  useEffect(() => {
    const requestLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = loc.coords;
        setLocationCoords([longitude, latitude]);
      } catch (e) {
        console.warn("Failed to get location:", e);
      }
    };
    requestLocation();
  }, []);

  return (
    <LocationContext.Provider value={{ locationCoords, locationAvailable: !!locationCoords }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationCoords = () => useContext(LocationContext);