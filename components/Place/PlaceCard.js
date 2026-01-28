import { View, Text, StyleSheet, Pressable } from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";
import { isoToFlagEmoji } from "../../util/fetches";
import { BirdSVG } from "../ui/Svgs";

const useStyles = (Colors) => React.useMemo(() => stylesFn(Colors), [Colors]);

const StatIconWrapper = ({ children }) => (
  <View
    style={{
      width: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    {children}
  </View>
);

const PlaceCard = React.memo(({ item }) => {
  const { Colors } = useTheme();
  const styles = useStyles(Colors);

  const territoryText = item.territory_data
    ? isoToFlagEmoji(item.territory_data.code)
    : null;

  const [lng, lat] = item.location.coordinates;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
    >
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexShrink: 1,
            }}
          >
            {item.favourite && (
              <Ionicons
                name="star"
                size={18}
                color={Colors.accent}
                style={styles.star}
              />
            )}
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {item.name}
            </Text>
          </View>

          {territoryText && <Text style={styles.flag}>{territoryText}</Text>}
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.coordRow}>
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
            <View style={styles.statItem}>
              <StatIconWrapper>
                <Ionicons
                  name="book-outline"
                  size={16}
                  color={Colors.textMain}
                />
              </StatIconWrapper>
              <Text style={styles.statValue}>{item.diary_count}</Text>
            </View>
            <View style={styles.statItem}>
              <StatIconWrapper>
                <Ionicons
                  name="eye-outline"
                  size={16}
                  color={Colors.textMain}
                />
              </StatIconWrapper>
              <Text style={styles.statValue}>{item.observation_count}</Text>
            </View>
            <View style={styles.statItem}>
              <StatIconWrapper>
                <BirdSVG size={16} color={Colors.textMain} />
              </StatIconWrapper>
              <Text style={styles.statValue}>{item.species_count}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

export default PlaceCard;

const stylesFn = (Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 10,
      marginBottom: 8,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.08,
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

    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      flexShrink: 1,
    },

    star: {
      marginRight: 6,
    },

    flag: {
      marginLeft: 6,
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

    statItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.badgeBg,
      borderRadius: 6,
      paddingHorizontal: 4,
    },

    statValue: {
      fontSize: 12,
      color: Colors.textMain,
      marginLeft: 2,
    },
  });
