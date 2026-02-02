import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  MapView,
  Camera,
  RasterSource,
  RasterLayer,
  MarkerView,
} from "@maplibre/maplibre-react-native";

import { useTheme } from "../store/theme-context";
import { isoToFlagEmoji } from "../util/fetches";
import { StatBig } from "../components/Place/StatBig";
import { MetaRow } from "../components/Place/MetaRow";
import { formatDate } from "../util/fetches";

const PlaceDetailScreen = ({ route, navigation }) => {
  const { place } = route.params;
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const [lng, lat] = place.location.coordinates;

  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{place.name}</Text>
          <Text style={styles.subtitle}>
            {place.territory_data.name}{" "}
            {isoToFlagEmoji(place.territory_data.code)}
          </Text>
        </View>

        <Ionicons
          name={place.favourite ? "star" : "star-outline"}
          size={26}
          color={Colors.accent}
        />
      </View>

      {/* MAP PREVIEW */}
      <View style={styles.mapWrapper}>
        <MapView
          style={styles.map}
          scrollEnabled={false}
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
            tileUrlTemplates={[
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            ]}
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

        <Text style={styles.coords}>
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </Text>
      </View>

      {/* STATS */}
      <View style={styles.stats}>
        <StatBig
          icon="eye-outline"
          value={place.observation_count}
          label="Observations"
          onPress={() =>
            navigation.navigate("Observations", { placeId: place.id })
          }
        />
        <StatBig value={place.species_count} label="Species" bird />
        <StatBig icon="book-outline" value={place.diary_count} label="Diary" />
      </View>

      {/* META */}
      <View style={styles.meta}>
        <MetaRow label="Created" value={formatDate(place.created_at)} />
        <MetaRow label="Updated" value={formatDate(place.updated_at)} />
      </View>
    </ScrollView>
  );
};

export default PlaceDetailScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.backgroundMain,
      padding: 16,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },

    title: {
      fontSize: 22,
      fontWeight: "700",
      color: Colors.textMain,
    },

    subtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginTop: 2,
    },

    mapWrapper: {
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: Colors.imageBg,
      marginBottom: 16,
    },

    map: {
      height: 200,
      width: "100%",
    },

    coords: {
      fontSize: 12,
      color: Colors.textSecondary,
      padding: 8,
    },

    stats: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginVertical: 16,
    },

    meta: {
      borderTopWidth: 1,
      borderColor: Colors.divider,
      paddingTop: 12,
    },

    marker: {
      textShadowColor: "rgba(0,0,0,0.3)",
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
  });
