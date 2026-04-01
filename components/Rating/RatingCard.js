import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import { BirdSVG } from "../ui/Svgs";
import { formatDateLong, isoToFlagEmoji } from "../../util/helpers";
import { useTheme } from "../../store/theme-context";
import ProfileAvatar from "../Profile/ProfileAvatar";
import { useProfileDisplay } from "../../hooks/Profile/useProfileDisplay";
const useStyles = (Colors) => React.useMemo(() => stylesFn(Colors), [Colors]);

const RatingCard = ({ item, index, isSelected, onToggle, profile }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = useStyles(Colors);
  const navigation = useNavigation();

  const { fullName } = useProfileDisplay({
    firstName: item.first_name,
    lastName: item.last_name,
    username: item.username,
  });

  const dateText = formatDateLong(item.last_update);
  const territoryFlag = item.territory_code
    ? isoToFlagEmoji(item.territory_code)
    : null;

  const handlePress = () => {
    profile?.user === item.profile_id
      ? navigation.navigate("Stat", { backTitle: t("rating") })
      : navigation.navigate("UserStat", { profileId: item.profile_id });
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
        <ProfileAvatar
          avatar={item.avatar}
          firstName={item.first_name}
          lastName={item.last_name}
          username={item.username}
          size={64}
          borderRadius={12}
          style={styles.image}
        />

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
      padding: 7,
      marginBottom: 4,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
      borderWidth: 1,
      borderColor: Colors.primary100,
    },

    pressedCard: {
      opacity: 0.85,
    },

    selectedCard: {
      borderColor: Colors.tabActiveColor,
    },

    row: {
      flexDirection: "row",
    },

    image: {
      marginRight: 8,
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

    flag: {
      fontSize: 14,
    },

    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 4,
    },

    metaText: {
      fontSize: 12,
      color: Colors.textSecondary,
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
  });
