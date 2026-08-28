import { ReactNode, Ref, useEffect, useRef, useState } from "react";
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
  MapRef,
  Camera,
  CameraRef,
  LngLatBounds,
  RasterSource,
  GeoJSONSource,
  Layer,
  PressEvent,
} from "@maplibre/maplibre-react-native";
import Toast from "react-native-toast-message";
import Clipboard from "@react-native-clipboard/clipboard";
import { useTranslation } from "react-i18next";

import { Config } from "../../constants/config";
import { SYMBOL_STROKE_WIDTH } from "../../constants/mapSymbolScale";
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

// The lone point this component plots is drawn as a dot, the same symbol the
// place maps use, so a place looks the same wherever it appears. Between the
// smallest and the largest class of that scale (see constants/mapSymbolScale),
// since a single point encodes no count.
const POINT_RADIUS = 10;

interface MapProps {
  currentCoords: Coords | null;
  mapHeight?: number;
  showCoords?: boolean;
  currentZoom?: number;
  onPress?: (e: PressEvent) => void;
  accuracy?: number;
  onUseMyLocation?: () => void;
  isLocating?: boolean;
  /**
   * Label on that button. The default ("Update GPS") is the editors' wording,
   * where the tap moves the pin; a read-only map only wants to be shown where
   * the viewer is standing, which is a different promise.
   */
  myLocationLabel?: string;
  /**
   * Extra room to the right of that button, for a map that has something of
   * its own in the bottom-right corner (the list screens' add button).
   */
  myLocationRightOffset?: number;
  /**
   * Drop the wording and draw the button as a round icon, the size the legend
   * toggle uses. For a map whose corner is already taken: the pill would have
   * to be pushed out of the bottom row, and a control floating above the add
   * button reads as detached from it.
   */
  myLocationCompact?: boolean;
  /**
   * Safe-area inset to lift the bottom overlays by. Only a map that runs to
   * the physical bottom of the screen needs it; one boxed inside a scrolling
   * screen (mapHeight) does not, which is why this is asked for rather than
   * read from the insets here.
   */
  bottomInset?: number;
  polygon?: PolygonGeometry;
  // Own sources/layers, drawn over the tiles instead of the single marker this
  // component plots by default (see PlacesMap). Everything around the
  // map — tiles, attribution, the offline/timeout fallback and its retry — is
  // the same either way, which is the whole point of passing them in here.
  children?: ReactNode;
  // [west, south, east, north]: frames a whole set of points rather than
  // centring on one. Ignored when currentCoords is given.
  bounds?: LngLatBounds;
  boundsPadding?: number;
  cameraRef?: Ref<CameraRef>;
  /** For callers that need to project coordinates to screen pixels. */
  mapRef?: Ref<MapRef>;
}

const MapL = ({
  currentCoords,
  currentZoom = 12,
  onPress = () => {},
  accuracy,
  mapHeight,
  onUseMyLocation,
  isLocating,
  myLocationLabel,
  myLocationRightOffset = 0,
  myLocationCompact = false,
  bottomInset = 0,
  showCoords,
  polygon,
  children,
  bounds,
  boundsPadding = 48,
  cameraRef,
  mapRef,
}: MapProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors, mapHeight, bottomInset, myLocationRightOffset);
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

  // Deliberately NOT keyed on lng/lat: those change on every marker
  // drag/tap/"use my location" while the underlying native <Map> stays
  // mounted (it only remounts on retryKey or an offline->online transition,
  // see the `showFallback ? ... : <Map key={retryKey}>` render below) — so
  // onDidFinishLoadingMap never fires again after the first load. Re-arming
  // this timeout on every coordinate change was resetting mapLoaded to false
  // (flashing the loading spinner) and then, 8s later with no matching
  // "finished loading" callback ever coming, flipping to the "connection
  // timeout" fallback even while fully online — reproducible just by tapping
  // the map to move the pin in PlaceEditor.
  useEffect(() => {
    if (offline) return;

    setMapLoaded(false);
    setLoadFailed(false);

    timeoutRef.current = setTimeout(() => {
      setLoadFailed(true);
    }, MAP_LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [offline, retryKey]);

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
              {offline ? t("map_unavailable_offline") : t("connection_timeout")}
            </Text>
            {offline && onUseMyLocation && (
              <Text style={styles.fallbackHint}>{t("map_offline_hint")}</Text>
            )}
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
              ref={mapRef}
              mapStyle={EMPTY_MAP_STYLE}
              logo={false}
              attribution={false}
              style={{ flex: 1 }}
              onPress={(e) => onPress(e.nativeEvent)}
              onDidFinishLoadingMap={handleMapLoaded}
              onDidFailLoadingMap={handleMapLoadError}
            >
              {currentCoords ? (
                <Camera
                  ref={cameraRef}
                  center={[lng!, lat!]}
                  zoom={Math.min(currentZoom, 19)}
                  minZoom={1}
                  maxZoom={19}
                  duration={500}
                />
              ) : bounds ? (
                <Camera
                  ref={cameraRef}
                  bounds={bounds}
                  padding={{
                    top: boundsPadding,
                    right: boundsPadding,
                    bottom: boundsPadding,
                    left: boundsPadding,
                  }}
                  minZoom={1}
                  maxZoom={19}
                  duration={500}
                />
              ) : (
                cameraRef && (
                  <Camera ref={cameraRef} minZoom={1} maxZoom={19} duration={500} />
                )
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

              {children}

              {!children && polygon && (
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

              {!children && !polygon && currentCoords && (
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
                    id="pointDot"
                    type="circle"
                    paint={{
                      "circle-radius": POINT_RADIUS,
                      "circle-color": Colors.placeDotFill,
                      "circle-stroke-color": Colors.placeDotStroke,
                      "circle-stroke-width": SYMBOL_STROKE_WIDTH,
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

        {/* Not gated on showFallback: device GPS doesn't need connectivity or
            reachable map tiles, so "use my location" stays usable even when
            the map itself can't render. */}
        {onUseMyLocation && (
          <TouchableOpacity
            style={
              myLocationCompact
                ? styles.myLocationCompact
                : styles.myLocationButton
            }
            onPress={onUseMyLocation}
            testID="map-locate-me"
            // The compact button says nothing out loud, so the wording it
            // dropped has to reach a screen reader some other way.
            accessibilityLabel={myLocationLabel ?? t("gps_locate_me_button")}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : (
              <Ionicons
                name="navigate"
                size={myLocationCompact ? 15 : 12}
                color={Colors.textSecondary}
              />
            )}
            {!myLocationCompact && (
              <Text style={styles.myLocationButtonText}>
                {myLocationLabel ?? t("gps_locate_me_button")}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Same reasoning: the accuracy readout is derived from GPS, not the
            map/network, so it stays visible in the fallback state too —
            that's exactly when the accuracy circle drawn on the map itself
            (which needs the map to render) is unavailable. */}
        {onUseMyLocation && hasAccuracy && (
          <View style={styles.accuracyOverlay}>
            <Ionicons
              name={accuracy! > 100 ? "warning-outline" : "locate-outline"}
              size={12}
              color={accuracy! > 100 ? Colors.error600 : Colors.textSecondary}
            />
            <Text style={styles.accuracyOverlayText}>
              {t("gps_accuracy_label", { value: Math.round(accuracy!) })}
            </Text>
          </View>
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

const stylesFn = (
  Colors: ThemeColors,
  mapHeight: number | undefined,
  bottomInset: number,
  myLocationRightOffset: number,
) =>
  StyleSheet.create({
    mapSection:
      mapHeight != null
        ? { height: mapHeight, position: "relative" }
        : { flex: 1, position: "relative" },
    container: { flex: 1, position: "relative" },
    myLocationCompact: {
      alignItems: "center",
      justifyContent: "center",
      position: "absolute",
      bottom: 12 + bottomInset,
      right: 12 + myLocationRightOffset,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: Colors.overlayBg,
    },
    myLocationButton: {
      flexDirection: "row",
      alignItems: "center",
      position: "absolute",
      bottom: 12 + bottomInset,
      right: 12 + myLocationRightOffset,
      paddingVertical: 3,
      paddingHorizontal: 6,
      backgroundColor: Colors.overlayBg,
      borderRadius: 12,
      gap: 4,
    },
    myLocationButtonText: {
      fontSize: 10,
      color: Colors.textSecondary,
      fontWeight: "500",
    },
    coordsOverlay: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      position: "absolute",
      bottom: 12 + bottomInset,
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
      bottom: 12 + bottomInset,
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
    fallbackHint: {
      marginTop: 4,
      fontSize: 11,
      color: Colors.textSecondary,
      opacity: 0.8,
      textAlign: "center",
    },
    accuracyOverlay: {
      flexDirection: "row",
      alignItems: "center",
      position: "absolute",
      top: 12,
      right: 12,
      paddingVertical: 3,
      paddingHorizontal: 6,
      backgroundColor: Colors.overlayBg,
      borderRadius: 12,
      gap: 4,
    },
    accuracyOverlayText: {
      fontSize: 10,
      color: Colors.textSecondary,
      fontWeight: "500",
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
