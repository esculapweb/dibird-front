import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Map,
  Camera,
  Images,
  RasterSource,
  GeoJSONSource,
  Layer,
  PressEvent,
} from "@maplibre/maplibre-react-native";
import Toast from "react-native-toast-message";
import Clipboard from "@react-native-clipboard/clipboard";
import { useTranslation } from "react-i18next";

import { Config } from "../../constants/config";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { Coords, PolygonGeometry } from "../../types";
import {
  isConnected,
  subscribeToConnectionChange,
} from "../../services/sync/networkStatus";

const EMPTY_MAP_STYLE = JSON.stringify({
  version: 8,
  sources: {},
  layers: [],
});

const MAP_LOAD_TIMEOUT_MS = 8000;

interface MapProps {
  currentCoords: Coords | null;
  mapHeight?: number;
  showCoords?: boolean;
  currentZoom?: number;
  onPress?: (e: PressEvent) => void;
  accuracy?: number;
  onUseMyLocation?: () => void;
  isLocating?: boolean;
  polygon?: PolygonGeometry;
}

const MapL = ({
  currentCoords,
  currentZoom = 12,
  onPress = () => {},
  accuracy,
  mapHeight,
  onUseMyLocation,
  isLocating,
  showCoords,
  polygon,
}: MapProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors, mapHeight);
  const { t } = useTranslation();

  const lng = currentCoords?.[0];
  const lat = currentCoords?.[1];

  const [offline, setOffline] = useState(!isConnected());
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => subscribeToConnectionChange((connected) => setOffline(!connected)),
    [],
  );

  useEffect(() => {
    if (offline || lng == null || lat == null) return;

    setMapLoaded(false);
    setLoadFailed(false);

    timeoutRef.current = setTimeout(() => {
      setLoadFailed(true);
    }, MAP_LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [offline, lng, lat, retryKey]);

  const handleMapLoaded = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMapLoaded(true);
    setLoadFailed(false);
  };

  const handleMapLoadError = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoadFailed(true);
  };

  const handleRetry = () => {
    setLoadFailed(false);
    setMapLoaded(false);
    setRetryKey((key) => key + 1);
  };

  const showFallback = offline || loadFailed;

  const handleCopyCoords = () => {
    const coordsText = `${lat!.toFixed(4)}, ${lng!.toFixed(4)}`;
    Clipboard.setString(coordsText);
    Toast.show({
      type: "success",
      text1: t("coordinates_copied"),
      text2: coordsText,
    });
  };

  const hasAccuracy = Boolean(accuracy && accuracy > 0);
  const sourceKey = polygon
    ? "polygon"
    : hasAccuracy
      ? "point-accuracy"
      : "point";
  const accuracyRadiusPx = hasAccuracy
    ? (accuracy! * Math.cos((lat! * Math.PI) / 180)) / 156543.03392
    : 0;

  return (
    <View style={styles.mapSection}>
      <View style={styles.container} pointerEvents="box-none">
        {showFallback ? (
          <View style={styles.fallback}>
            <Ionicons
              name={offline ? "cloud-offline-outline" : "alert-circle-outline"}
              size={26}
              color={Colors.textSecondary}
            />
            <Text style={styles.fallbackText}>
              {offline ? t("no_connection") : t("connection_timeout")}
            </Text>
            {currentCoords && (
              <TouchableOpacity
                style={styles.fallbackCoords}
                onPress={handleCopyCoords}
              >
                <Text style={styles.fallbackCoordsText}>
                  {lat!.toFixed(4)}, {lng!.toFixed(4)}
                </Text>
                <Ionicons
                  name="copy-outline"
                  size={12}
                  color={Colors.textSecondary}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            )}
            {!offline && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleRetry}
              >
                <Text style={styles.retryButtonText}>{t("try_again")}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <Map
              key={retryKey}
              mapStyle={EMPTY_MAP_STYLE}
              logo={false}
              attribution={false}
              style={{ flex: 1 }}
              onPress={(e) => onPress(e.nativeEvent)}
              onDidFinishLoadingMap={handleMapLoaded}
              onDidFailLoadingMap={handleMapLoadError}
            >
              <Images
                images={{
                  marker: require("../../assets/marker1.png"),
                }}
              />

              {currentCoords && (
                <Camera
                  center={[lng!, lat!]}
                  zoom={Math.min(currentZoom, 19)}
                  minZoom={1}
                  maxZoom={19}
                  duration={500}
                />
              )}

              <RasterSource
                id="osmTiles"
                tiles={[Config.mapTileUrl]}
                tileSize={256}
                minzoom={0}
                maxzoom={19}
              >
                <Layer type="raster" id="osmLayer" />
              </RasterSource>

              {polygon && (
                <GeoJSONSource
                  key={sourceKey}
                  id="polygonSource"
                  data={{ type: "Feature", geometry: polygon, properties: {} }}
                >
                  <Layer
                    id="polygonFill"
                    type="fill"
                    paint={{ "fill-color": Colors.squareFill }}
                  />
                  <Layer
                    id="polygonStroke"
                    type="line"
                    paint={{
                      "line-color": Colors.squareStroke,
                      "line-width": 2,
                    }}
                  />
                </GeoJSONSource>
              )}

              {!polygon && currentCoords && (
                <GeoJSONSource
                  key={sourceKey}
                  id="pointSource"
                  data={{
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [lng!, lat!] },
                    properties: {},
                  }}
                >
                  {hasAccuracy && (
                    <Layer
                      id="accuracyCircle"
                      type="circle"
                      paint={{
                        "circle-radius": [
                          "interpolate",
                          ["exponential", 2],
                          ["zoom"],
                          0,
                          accuracyRadiusPx,
                          22,
                          accuracyRadiusPx * Math.pow(2, 22),
                        ],
                        "circle-color": Colors.accuracyFill,
                        "circle-stroke-color": Colors.accuracyStroke,
                        "circle-stroke-width": 1,
                      }}
                    />
                  )}
                  <Layer
                    id="pointIcon"
                    type="symbol"
                    layout={{
                      "icon-image": "marker",
                      "icon-size": 1,
                      "icon-anchor": "bottom",
                      "icon-allow-overlap": true,
                    }}
                  />
                </GeoJSONSource>
              )}
            </Map>

            {!mapLoaded && (
              <View style={styles.loadingOverlay} pointerEvents="none">
                <ActivityIndicator size="small" color={Colors.textSecondary} />
              </View>
            )}
          </>
        )}

        {!showFallback && onUseMyLocation && (
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={onUseMyLocation}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.textMain} />
            ) : (
              <Ionicons name="navigate" size={22} color={Colors.textMain} />
            )}
          </TouchableOpacity>
        )}

        {!showFallback && showCoords && currentCoords && (
          <TouchableOpacity
            style={styles.coordsOverlay}
            onPress={handleCopyCoords}
          >
            <Text style={styles.coordsOverlayText}>
              {lat!.toFixed(4)}, {lng!.toFixed(4)}
            </Text>
            <Ionicons
              name="copy-outline"
              size={12}
              color={Colors.textSecondary}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        )}

        {!showFallback && (
          <TouchableOpacity
            style={styles.attribution}
            onPress={() =>
              Linking.openURL("https://www.openstreetmap.org/copyright")
            }
          >
            <Text style={styles.attributionText}>
              © OpenStreetMap contributors
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default MapL;

const stylesFn = (Colors: ThemeColors, mapHeight?: number) =>
  StyleSheet.create({
    mapSection:
      mapHeight != null
        ? { height: mapHeight, position: "relative" }
        : { flex: 1, position: "relative" },
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
    coordsOverlay: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      position: "absolute",
      bottom: 12,
      right: 12,
      paddingVertical: 3,
      paddingHorizontal: 6,
      backgroundColor: Colors.overlayBg,
      borderRadius: 12,
    },
    coordsOverlayText: {
      fontSize: 10,
      color: Colors.textSecondary,
      fontWeight: "500",
    },
    attribution: {
      position: "absolute",
      left: 12,
      bottom: 12,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 12,
      backgroundColor: Colors.overlayBg,
    },
    attributionText: {
      fontSize: 10,
      color: Colors.textSecondary,
    },
    fallback: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.imageBg,
      padding: 16,
    },
    fallbackText: {
      marginTop: 8,
      fontSize: 13,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    fallbackCoords: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    fallbackCoordsText: {
      fontSize: 11,
      color: Colors.textSecondary,
      opacity: 0.8,
    },
    retryButton: {
      marginTop: 12,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    retryButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.main100,
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.imageBg,
    },
  });
