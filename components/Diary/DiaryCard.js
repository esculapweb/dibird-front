import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import { BirdSVG } from "../ui/Svgs";
import { formatDate, isoToFlagEmoji } from "../../util/helpers";
import { Config } from "../../constants/config";
import { useTheme } from "../../store/theme-context";
import { formatTimeString } from "../../util/timeHelpers";
import StatItem from "../ui/StatItem";

const useStyles = (Colors) => React.useMemo(() => stylesFn(Colors), [Colors]);

const DiaryCard = ({ item, index }) => {
  const { Colors } = useTheme();
  const styles = useStyles(Colors);
  const navigation = useNavigation();

  const dateText = formatDate(item.date_time);
  const territoryText = item.territory_data
    ? isoToFlagEmoji(item.territory_data.code)
    : null;

  const handlePress = () => {
    navigation.navigate("DiaryDetail", { diaryId: item.id });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
      onPress={handlePress}
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
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {index + 1}. {item.name || dateText}
            </Text>
          </View>

          {territoryText && <Text style={styles.flag}>{territoryText}</Text>}
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.coordRow}>
            {item?.place_data?.name ? (
              <>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={Colors.textSecondary}
                />
                <Text style={styles.subLine}>{item?.place_data?.name}</Text>
              </>
            ) : null}
          </View>

          <View style={styles.statsBlock}>
            {/* <StatItem icon="book-outline" txt={item.diary_count} /> */}
            <StatItem txt={item.observation_count}>
              <BirdSVG size={16} color={Colors.textMain} />
            </StatItem>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default DiaryCard;

const stylesFn = (Colors) =>
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
      justifyContent: "space-around",
      backgroundColor: Colors.badgeBg,
      borderRadius: 6,
      paddingHorizontal: 4,
    },

    statItemInner: {
      width: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
    },

    statValue: {
      fontSize: 12,
      color: Colors.textMain,
      marginLeft: 2,
    },
  });
