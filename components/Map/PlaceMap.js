import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
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
import { Dimensions } from "react-native";

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
  const screenHeight = Dimensions.get("window").height;
  const mapHeight = Math.min(Math.max(screenHeight * 0.5, 200), 500);

  const { Colors } = useTheme();
  const styles = stylesFn(Colors, iconSize, mapHeight);
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
      <View style={[styles.container, style]} pointerEvents="box-none">
        <MapView
          style={styles.map}
          onPress={handlePress}
          minZoomLevel={1}
          maxZoomLevel={19}
          rotateEnabled={false}
          pitchEnabled={false}
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
            <Ionicons name="navigate" size={22} color={Colors.primary500} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const stylesFn = (Colors, iconSize, mapHeight) =>
  StyleSheet.create({
    mapSection: { height: mapHeight, position: "relative" },
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
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: Colors.primary100,
      alignItems: "center",
      justifyContent: "center",
      hadowColor: Colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
  });
