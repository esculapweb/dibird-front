import { useMemo, memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { isoToFlagEmoji, normalizeDistance } from "../../util/helpers";
import { BirdSVG } from "../ui/Svgs";
import StatItem from "../ui/StatItem";
import { AppStackNavigationProp, PlaceItem } from "../../types";

const useStyles = (Colors: ThemeColors) => useMemo(() => stylesFn(Colors), [Colors]);

const PlaceCard = memo(({ item, index }: {item: PlaceItem, index: number}) => {
  const { Colors } = useTheme();
  const styles = useStyles(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();

  const territoryText = item.territory_data
    ? isoToFlagEmoji(item.territory_data.code)
    : null;

  const [lng, lat] = item.location.coordinates;

  const handlePlacePress = () => {
    navigation.navigate("PlaceDetail", { placeId: item.id, initialPlace: item });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
      onPress={handlePlacePress}
    >
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.index}>{index + 1}.</Text>
            {item.favourite && (
              <Ionicons name="star" size={18} color={Colors.yellow} />
            )}
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {item.name}
            </Text>
          </View>

          <View style={styles.titleRight}>
            {item._pendingSync && (
              <Ionicons
                name={
                  item._pendingSync === "error"
                    ? "warning-outline"
                    : "cloud-upload-outline"
                }
                size={14}
                color={
                  item._pendingSync === "error"
                    ? Colors.error600
                    : Colors.textSecondary
                }
                style={{ marginRight: 4 }}
              />
            )}
            {territoryText && <Text style={styles.flag}>{territoryText}</Text>}
          </View>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.coordRow}>
            {item.distance != null && (
              <Text style={styles.distance}>
                {normalizeDistance(item.distance)}
              </Text>
            )}

            <Ionicons
              name="location-outline"
              size={16}
              color={Colors.textSecondary}
            />
            <Text style={styles.subLine}>
              {lat.toFixed(4)}, {lng.toFixed(4)}
            </Text>
          </View>

          <View style={styles.statsBlock}>
            {/* <StatItem icon="book-outline" txt={item.diary_count} /> */}
            <StatItem icon="binoculars" txt={item.observation_count} />
            <StatItem txt={item.species_count}>
              <BirdSVG size={16} color={Colors.textMain} />
            </StatItem>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

export default PlaceCard;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 10,
      marginBottom: 4,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    pressedCard: { opacity: 0.85 },

    main: {
      marginBottom: 0,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },

    titleLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
    },
    index: {
      fontSize: 12,
      color: Colors.textSecondary,
    },

    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      flexShrink: 1,
    },
    flag: {
      marginLeft: 6,
    },
    titleRight: {
      flexDirection: "row",
      alignItems: "center",
    },

    bottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 2,
    },

    coordRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexShrink: 1,
    },

    subLine: {
      fontSize: 12,
      color: Colors.textSecondary,
    },

    statsBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    distance: {
      fontSize: 12,
      color: Colors.main100,
      marginRight: 8,
    },
  });
