import { StyleSheet, View } from "react-native";
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
  const styles = stylesFn(Colors);
  const [lng, lat] = coordinates;

  return (
    <MapView style={styles.map} rotateEnabled={false} pitchEnabled={false}>
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

export default MapPreview;

const stylesFn = (Colors) =>
  StyleSheet.create({
    map: {
      height: 340,
      width: "100%",
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
