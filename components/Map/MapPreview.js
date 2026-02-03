import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  MapView,
  Camera,
  RasterSource,
  RasterLayer,
  MarkerView,
} from "@maplibre/maplibre-react-native";

import { useTheme } from "../../store/theme-context";

const MapPreview = ({ coordinates }) => {
  const { Colors } = useTheme();
  const [lng, lat] = coordinates;

  return (
    <MapView
      style={styles.map}
    //   scrollEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      <Camera
        centerCoordinate={[lng, lat]}
        zoomLevel={12}
        animationDuration={0}
      />

      <RasterSource
        id="osmTiles"
        tileUrlTemplates={["https://tile.openstreetmap.org/{z}/{x}/{y}.png"]}
        tileSize={256}
      >
        <RasterLayer id="osmLayer" sourceID="osmTiles" />
      </RasterSource>

      <MarkerView coordinate={[lng, lat]}>
        <Ionicons
          name="location-sharp"
          size={32}
          color={Colors.error600}
          style={styles.marker}
        />
      </MarkerView>
    </MapView>
  );
};

export default MapPreview;

const styles = StyleSheet.create({
  map: {
    height: 300,
    width: "100%",
  },
  marker: {
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
