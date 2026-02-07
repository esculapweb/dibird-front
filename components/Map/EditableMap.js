// components/Map/EditableMap.js
import { StyleSheet, Dimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  MapView,
  Camera,
  RasterSource,
  RasterLayer,
  MarkerView,
} from "@maplibre/maplibre-react-native";
import { useTheme } from "../../store/theme-context";

const { width, height } = Dimensions.get("window");

const EditableMap = ({
  coordinates,
  onCoordinateChange,
  editable = true,
  fullScreen = false, // Новый проп
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [lng, lat] = coordinates;

  const handleMapPress = (event) => {
    if (!editable) return;

    const { geometry } = event;
    if (geometry && geometry.coordinates) {
      onCoordinateChange(geometry.coordinates);
    }
  };

  return (
    <MapView
      style={[styles.map, fullScreen && styles.fullScreenMap]}
      onPress={handleMapPress}
      scrollEnabled={editable}
      zoomEnabled={editable}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      <Camera
        centerCoordinate={[lng, lat]}
        zoomLevel={fullScreen ? 14 : 12} // Больший zoom при полноэкранном режиме
        animationDuration={300}
      />

      <RasterSource
        id="osmTiles"
        tileUrlTemplates={["https://tile.openstreetmap.org/{z}/{x}/{y}.png"]}
        tileSize={256}
      >
        <RasterLayer id="osmLayer" sourceID="osmTiles" />
      </RasterSource>

      <MarkerView coordinate={[lng, lat]} anchor={{ x: 0.5, y: 1 }}>
        <View style={styles.markerContainer}>
          <Ionicons name="location-sharp" size={32} color={Colors.error600} />
        </View>
      </MarkerView>

      <MarkerView coordinate={[lng, lat]} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={styles.exactPoint} />
      </MarkerView>
    </MapView>
  );
};

export default EditableMap;

const stylesFn = (Colors) => StyleSheet.create({
  map: {
    height: 200,
    width: "100%",
  },
  fullScreenMap: {
    height: height * 0.6, // 60% высоты экрана
    width: "100%",
  },
  marker: {
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  markerContainer: {
    marginBottom: 36,
  },
  exactPoint: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.error600,
      borderWidth: 1,
      borderColor: Colors.markerBorder,
    },
});
