import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
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

const EMPTY_MAP_STYLE = JSON.stringify({
  version: 8,
  sources: {},
  layers: [],
});

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

  const hasAccuracy = Boolean(accuracy && accuracy > 0);
  const sourceKey = polygon
    ? "polygon"
    : hasAccuracy
      ? "point-accuracy"
      : "point";

  return (
    <View style={styles.mapSection}>
      <View style={styles.container} pointerEvents="box-none">
        <Map
          mapStyle={EMPTY_MAP_STYLE}
          attributionPosition={{ bottom: 16, left: 16 }}
          style={{ flex: 1 }}
          onPress={(e) => onPress(e.nativeEvent)}
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
                paint={{ "line-color": Colors.squareStroke, "line-width": 2 }}
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
                      ["linear"],
                      ["zoom"],
                      8,
                      accuracy! / 3,
                      15,
                      accuracy! / 1.5,
                      20,
                      accuracy!,
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

        {onUseMyLocation && (
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

        {showCoords && currentCoords && (
          <TouchableOpacity
            style={styles.coordsOverlay}
            onPress={() => {
              const coordsText = `${lat!.toFixed(4)}, ${lng!.toFixed(4)}`;
              Clipboard.setString(coordsText);
              Toast.show({
                type: "success",
                text1: t("coordinates_copied"),
                text2: coordsText,
              });
            }}
          >
            <Text style={styles.coordsOverlayText}>
              {lat!.toFixed(4)}, {lng!.toFixed(4)}
            </Text>
            <Ionicons
              name="copy-outline"
              size={16}
              color={Colors.textSecondary}
              style={{ marginLeft: 6 }}
            />
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
      bottom: 16,
      right: 16,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: Colors.overlayBg,
      borderRadius: 12,
    },
    coordsOverlayText: {
      fontSize: 12,
      color: Colors.textSecondary,
      fontWeight: "500",
    },
  });
