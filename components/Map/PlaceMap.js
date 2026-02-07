import { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  MapView,
  Camera,
  RasterSource,
  RasterLayer,
  PointAnnotation,
} from "@maplibre/maplibre-react-native";
import { useTheme } from "../../store/theme-context";

export const PlaceMap = ({
  coords,
  onCoordsChange,
  isGeocoding,
  onUseMyLocation,
  zoomLevel = 12,
  style,
}) => {
  const { Colors, theme } = useTheme();
  const styles = stylesFn(Colors, theme);

  const [currentCoords, setCurrentCoords] = useState(coords);
  const [currentZoom, setCurrentZoom] = useState(zoomLevel);

  const isAnimatingRef = useRef(false);

  const handlePress = useCallback(
    (event) => {
      const { geometry } = event;
      if (geometry?.coordinates) {
        const [lng, lat] = geometry.coordinates;
        setCurrentCoords([lng, lat]);
        onCoordsChange?.([lng, lat]);
      }
    },
    [onCoordsChange],
  );

  const animateCamera = useCallback(
    (newCoords, newZoom = 14) => {
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;

      setCurrentCoords(newCoords);
      setCurrentZoom(newZoom);
      onCoordsChange?.(newCoords);

      setTimeout(() => (isAnimatingRef.current = false), 300);
    },
    [onCoordsChange],
  );

  const [lng, lat] = currentCoords;

  return (
    <View style={[styles.container, style]}>
      <MapView style={styles.map} onPress={handlePress}>
        <Camera
          centerCoordinate={currentCoords}
          zoomLevel={currentZoom}
          animationDuration={1000}
        />
        <RasterSource
          id="osmTiles"
          tileUrlTemplates={["https://tile.openstreetmap.org/{z}/{x}/{y}.png"]}
          tileSize={256}
        >
          <RasterLayer id="osmLayer" sourceID="osmTiles" />
        </RasterSource>

        <PointAnnotation id="selected-point" coordinate={[lng, lat]}>
          <View style={styles.markerContainer}>
            <Ionicons name="location-sharp" size={32} color={Colors.error600} />
          </View>
        </PointAnnotation>
      </MapView>

      <TouchableOpacity
        style={styles.myLocationButton}
        onPress={onUseMyLocation}
      >
        {isGeocoding ? (
          <ActivityIndicator size="small" color={Colors.textMain} />
        ) : (
          <Ionicons name="navigate" size={22} color={Colors.textMain} />
        )}
      </TouchableOpacity>

      {isGeocoding && (
        <View style={styles.geocodingOverlay}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.geocodingText}>Detecting location...</Text>
        </View>
      )}

      <View style={styles.mapHintContainer}>
        <Ionicons
          name="hand-left-outline"
          size={14}
          color={Colors.textSecondary}
        />
        <Text style={styles.mapHintText}>Tap to select location</Text>
      </View>
    </View>
  );
};

const stylesFn = (Colors, theme) =>
  StyleSheet.create({
    container: { flex: 1, position: "relative" },
    map: { flex: 1 },
    markerContainer: { alignItems: "center", justifyContent: "center" },
    myLocationButton: {
      position: "absolute",
      bottom: 20,
      right: 20,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Colors.buttonBg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: Colors.border,
    },
    geocodingOverlay: {
      position: "absolute",
      top: 20,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        theme === "dark" ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 25,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: 8,
    },
    geocodingText: { fontSize: 14, color: Colors.textMain, fontWeight: "500" },
    mapHintContainer: {
      position: "absolute",
      bottom: 20,
      left: 20,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        theme === "dark" ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: 6,
    },
    mapHintText: { fontSize: 12, color: Colors.textMain },
  });
