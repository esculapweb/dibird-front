import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Dimensions } from "react-native";

import { useTheme } from "../../store/theme-context";
import Map from "./Map";

export const PlaceMap = ({
  coords,
  onCoordsChange,
  isGeocoding,
  onUseMyLocation,
  zoomLevel = 12,
  accuracy = 0,
}) => {
  const screenHeight = Dimensions.get("window").height;
  const mapHeight = Math.min(Math.max(screenHeight * 0.5, 200), 500);

  const { Colors } = useTheme();
  const styles = stylesFn(Colors, mapHeight);

  const [currentCoords, setCurrentCoords] = useState(coords);
  const [currentZoom, setCurrentZoom] = useState(zoomLevel);

  const animationRef = useRef(null);

  const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  const animateTo = useCallback(
    (targetCoords, targetZoom = currentZoom, duration = 500) => {
      if (!targetCoords) return;

      const [startLng, startLat] = currentCoords;
      const [endLng, endLat] = targetCoords;
      const startZoom = currentZoom;
      const endZoom = targetZoom;

      const startTime = Date.now();

      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      const step = () => {
        const now = Date.now();
        let t = Math.min(1, (now - startTime) / duration);
        t = easeInOutQuad(t);

        const lngNow = startLng + (endLng - startLng) * t;
        const latNow = startLat + (endLat - startLat) * t;
        const zoomNow = startZoom + (endZoom - startZoom) * t;

        setCurrentCoords([lngNow, latNow]);
        setCurrentZoom(zoomNow);

        if (t < 1) animationRef.current = requestAnimationFrame(step);
      };

      step();
    },
    [currentCoords, currentZoom],
  );

  const handlePress = useCallback(
    (event) => {
      if (isGeocoding) return;
      const [lng, lat] = event.geometry.coordinates;
      animateTo([lng, lat], Math.min(currentZoom, 19), 500);
      onCoordsChange?.([lng, lat]);
    },
    [animateTo, onCoordsChange, currentZoom, isGeocoding],
  );

  useEffect(() => {
    if (
      coords &&
      (coords[0] !== currentCoords[0] || coords[1] !== currentCoords[1])
    ) {
      animateTo(coords, Math.min(currentZoom, 19), 500);
    }
  }, [coords]);

  return (
    <View style={styles.mapSection}>
      <View style={styles.container} pointerEvents="box-none">
        <Map
          onPress={handlePress}
          currentCoords={currentCoords}
          currentZoom={currentZoom}
          accuracy={accuracy}
        />

        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={onUseMyLocation}
        >
          {isGeocoding ? (
            <ActivityIndicator size="small" color={Colors.textMain} />
          ) : (
            <Ionicons name="navigate" size={22} color={Colors.primary500} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const stylesFn = (Colors, mapHeight) =>
  StyleSheet.create({
    mapSection: { height: mapHeight, position: "relative" },
    container: { flex: 1, position: "relative" },
    myLocationButton: {
      alignItems: "center",
      justifyContent: "center",
      position: "absolute",
      bottom: 16,
      right: 16,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: Colors.primary100,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
  });
