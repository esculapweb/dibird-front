import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";

import { BirdSVG } from "../ui/Svgs";
import { formatDateLong, isoToFlagEmoji } from "../../util/helpers";
import { Config } from "../../constants/config";
import { useTheme } from "../../store/theme-context";

const useStyles = (Colors) => React.useMemo(() => stylesFn(Colors), [Colors]);

const RatingCard = ({ item, index, isSelected, onToggle }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = useStyles(Colors);
  const navigation = useNavigation();
  const avatarName =
    item.first_name && item.last_name
      ? `${item.first_name[0]}${item.last_name[0]}`
      : item.username.slice(0, 2);

  const fullName =
    item.first_name && item.last_name
      ? `${item.first_name} ${item.last_name}`
      : item.username;

  const dateText = formatDateLong(item.last_update);
  const territoryFlag = item.territory_code
    ? isoToFlagEmoji(item.territory_code)
    : null;

  const handlePress = () => {
    navigation.navigate("UserStat", { profileId: item.profile_id });
  };
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressedCard,
        isSelected && styles.selectedCard,
      ]}
      onPress={handlePress}
    >
      <View style={styles.row}>
        {item.avatar ? (
          <Image
            source={{ uri: `${Config.mediaUrl}/${item.avatar}` }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.avatarName}>{avatarName}</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <View style={styles.indexBadge}>
                <Text style={styles.index}>{index + 1}.</Text>
              </View>
              {territoryFlag && (
                <Text style={styles.flag}>{territoryFlag}</Text>
              )}
              <Text style={styles.title} numberOfLines={1}>
                {fullName}
              </Text>
              
            </View>
          </View>

          <View style={styles.countRow}>
            <BirdSVG size={16} color={Colors.textMain} />
            <Text style={styles.countNum}>{item.seen_qty}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {t("last_update")} {dateText}
            </Text>
          </View>
        </View>

        <Pressable style={styles.addIcon} onPress={onToggle} hitSlop={8}>
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={28}
            color={isSelected ? Colors.tabActiveColor : Colors.textSecondary}
          />
        </Pressable>
      </View>
    </Pressable>
  );
};

export default RatingCard;

const stylesFn = (Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 8,
      marginBottom: 4,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    pressedCard: {
      opacity: 0.85,
    },

    row: {
      flexDirection: "row",
    },

    image: {
      width: 64,
      height: 64,
      borderRadius: 12,
      marginRight: 8,
      backgroundColor: Colors.imageBg,
    },

    imagePlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 12,
      marginRight: 8,
      backgroundColor: Colors.primary500,
      justifyContent: "center",
      alignItems: "center",
    },

    avatarName: {
      fontSize: 36,
      color: Colors.primary100,
      fontWeight: "bold",
    },

    content: {
      flex: 1,
    },

    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
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
      flexShrink: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      flex: 1,
    },

    rightTop: {
      flexDirection: "row",
      alignItems: "center",
    },

    flag: {
      fontSize: 14,
    },

    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 4,
    },
    metaLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },

    metaText: {
      fontSize: 12,
      color: Colors.textSecondary,
    },

    placeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 3,
    },

    placeText: {
      fontSize: 12,
      color: Colors.textSecondary,
      flex: 1,
    },

    addIcon: {
      justifyContent: "center",
      alignSelf: "stretch",
      paddingLeft: 8,
    },

    countRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
      marginBottom: 2,
    },
    countNum: {
      fontSize: 20,
      fontWeight: "600",
      color: Colors.textMain,
    },
    selectedCard: {
      borderWidth: 1,
      borderColor: Colors.tabActiveColor,
    },
  });
