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
  ShapeSource,
  SymbolLayer,
  CircleLayer,
} from "@maplibre/maplibre-react-native";
import Toast from "react-native-toast-message";
import Clipboard from "@react-native-clipboard/clipboard";
import { useTranslation } from "react-i18next"; 

import { Config } from "../../constants/config";
import { useTheme } from "../../store/theme-context";

const Map = ({
  currentCoords,
  currentZoom = 12,
  onPress = () => {},
  accuracy,
  mapHeight,
  onUseMyLocation,
  isLocating,
  showCoords
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors, mapHeight);
  const { t } = useTranslation();

  const [lng, lat] = currentCoords ?? [];

  const metersToPixels = (meters, latitude, zoom) => {
    const earthCircumference = 40075016.686;
    const latRad = (latitude * Math.PI) / 180;
    const mapWidth = 512 * Math.pow(2, zoom);
    return (meters / (earthCircumference * Math.cos(latRad))) * mapWidth;
  };

  return (
    <View style={styles.mapSection}>
      <View style={styles.container} pointerEvents="box-none">
        <MapView
          // attributionEnabled={false}
          // logoEnabled={false}
          attributionPosition={{ bottom: 16, left: 16 }}
          style={{ flex: 1 }}
          onPress={onPress}
          minZoomLevel={1}
          maxZoomLevel={19}
        >
          <Camera
            centerCoordinate={[lng, lat]}
            zoomLevel={Math.min(currentZoom, 19)}
            animationDuration={500}
          />
          <RasterSource
            id="osmTiles"
            tileUrlTemplates={[Config.mapTileUrl]}
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
            {accuracy && accuracy > 0 && (
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
            <SymbolLayer
              id="selectedPointIcon"
              sourceID="selectedPoint"
              style={{
                iconImage: require("../../assets/marker1.png"),
                iconSize: 1,
                iconAnchor: "bottom",
                iconAllowOverlap: true,
              }}
            />
          </ShapeSource>
        </MapView>

        {onUseMyLocation && (
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={onUseMyLocation}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={Colors.textMain} />
            ) : (
              <Ionicons name="navigate" size={22} color={Colors.primary500} />
            )}
          </TouchableOpacity>
        )}

        {showCoords && (
          <TouchableOpacity
            style={styles.coordsOverlay}
            onPress={() => {
              const coordsText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
              Clipboard.setString(coordsText);
              Toast.show({
                type: "success",
                text1: t("coordinates_copied"),
                text2: coordsText,
                position: "bottom",
                visibilityTime: 1500,
              });
            }}
          >
            <Text style={styles.coordsOverlayText}>
              {lat.toFixed(4)}, {lng.toFixed(4)}
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

export default Map;

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
