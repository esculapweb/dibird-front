import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  MapView,
  Camera,
  RasterSource,
  RasterLayer,
  ShapeSource,
  SymbolLayer,
  PointAnnotation,
  CircleLayer,
} from "@maplibre/maplibre-react-native";

import { useTheme } from "../../store/theme-context";

const iconSize = 32;

export const PlaceMap = ({
  coords,
  onCoordsChange,
  isGeocoding,
  onUseMyLocation,
  zoomLevel = 12,
  style,
  accuracy = 0,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors, iconSize);
  const { t } = useTranslation();

  const [currentCoords, setCurrentCoords] = useState(coords);
  const [currentZoom, setCurrentZoom] = useState(zoomLevel);

  const animationRef = useRef(null);
  const [lng, lat] = currentCoords ?? [];

  const metersToPixels = (meters, latitude, zoom) => {
    const earthCircumference = 40075016.686;
    const latRad = (latitude * Math.PI) / 180;
    const mapWidth = 512 * Math.pow(2, zoom);
    return (meters / (earthCircumference * Math.cos(latRad))) * mapWidth;
  };

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
      const [lng, lat] = event.geometry.coordinates;
      animateTo([lng, lat], Math.min(currentZoom, 19), 500);
      onCoordsChange?.([lng, lat]);
    },
    [animateTo, onCoordsChange, currentZoom],
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
      <View style={[styles.container, style]}>
        <MapView
          style={styles.map}
          onPress={handlePress}
          minZoomLevel={1}
          maxZoomLevel={19}
        >
          <Camera
            centerCoordinate={currentCoords}
            zoomLevel={Math.min(currentZoom, 19)}
            animationDuration={0}
          />
          <RasterSource
            id="osmTiles"
            tileUrlTemplates={[
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ]}
            tileSize={256}
          >
            <RasterLayer id="osmLayer" sourceID="osmTiles" />
          </RasterSource>

          <ShapeSource
            id="selectedPoint"
            shape={{
              type: "Feature",
              geometry: { type: "Point", coordinates: [lng, lat] },
            }}
          >
            {Platform.OS !== "ios" && accuracy > 0 && (
              <CircleLayer
                id="accuracyCircleLayer"
                sourceID="selectedPoint"
                style={{
                  circleRadius: metersToPixels(accuracy, lat, currentZoom),
                  circleColor: "rgba(0,150,255,0.2)",
                  circleStrokeColor: "rgba(0,150,255,0.3)",
                  circleStrokeWidth: 1,
                }}
              />
            )}

            {Platform.OS !== "ios" && (
              <SymbolLayer
                id="selectedPointIcon"
                sourceID="selectedPoint"
                style={{
                  iconImage: require("../../assets/marker.png"),
                  iconSize: 1,
                  iconAnchor: "bottom",
                  iconAllowOverlap: true,
                }}
              />
            )}
          </ShapeSource>

          {Platform.OS === "ios" && (
            <PointAnnotation id="selected-point" coordinate={[lng, lat]}>
              <View style={styles.markerContainer}>
                <Ionicons
                  name="location-sharp"
                  size={iconSize}
                  color={Colors.error600}
                />
              </View>
            </PointAnnotation>
          )}
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
            <Text style={styles.geocodingText}>{t("detecting_location")}</Text>
          </View>
        )}

        <View style={styles.mapHintContainer}>
          <Ionicons
            name="hand-left-outline"
            size={14}
            color={Colors.textSecondary}
          />
          <Text style={styles.mapHintText}>{t("tap_to_select_location")}</Text>
        </View>
      </View>
    </View>
  );
};

const stylesFn = (Colors, iconSize) =>
  StyleSheet.create({
    mapSection: { height: 400, position: "relative" },
    container: { flex: 1, position: "relative" },
    map: { flex: 1 },
    markerContainer: {
      alignItems: "center",
      justifyContent: "center",
      transform: [{ translateY: -iconSize / 2 }],
      borderRadius: iconSize / 2,
      shadowColor: "#fff",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: 2,
    },
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
      backgroundColor: Colors.overlayBg,
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
      backgroundColor: Colors.overlayBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.border,
      gap: 6,
    },
    mapHintText: { fontSize: 12, color: Colors.textMain },
  });
