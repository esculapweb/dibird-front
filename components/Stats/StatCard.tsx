import { useMemo, memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";

import { formatDate, isoToFlagEmoji } from "../../util/helpers";
import { Config } from "../../constants/config";
import { useTheme, ThemeColors } from "../../store/theme-context";
import MetaItem from "../ui/MetaItem";
import { BirdSVG } from "../ui/Svgs";
import { seenMode, SpeciesItem } from "../../types";

const useStyles = (Colors: ThemeColors) =>
  useMemo(() => stylesFn(Colors), [Colors]);

interface StatCardProps {
  item: SpeciesItem;
  index: number;
  seenMode: seenMode;
  onPress: () => void;
  personal?: boolean;
}

const StatCard = memo(
  ({ item, index, seenMode, onPress, personal = false }: StatCardProps) => {
    const { t } = useTranslation();
    const { Colors } = useTheme();
    const styles = useStyles(Colors);

    const isSeen = item.seen;
    const isAllMode = seenMode === "all";
    const showSmallImage = !isSeen && seenMode === "unseen";

    const minDate = item?.min_date && formatDate(item.min_date);
    const maxDate = item?.max_date && formatDate(item.max_date);

    const dateText =
      minDate && maxDate && minDate !== maxDate
        ? `${minDate} – ${maxDate}`
        : minDate || maxDate;

    const qty = item?.qty_countries ?? 0;

    const countriesText = item?.min_territory
      ? `${isoToFlagEmoji(item.min_territory)}${
          item?.max_territory && item.max_territory !== item.min_territory
            ? isoToFlagEmoji(item.max_territory)
            : ""
        }${qty > 2 ? ` +${qty - 2}` : ""}`
      : null;

    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          !isSeen && styles.cardUnseen,
          pressed && styles.pressedCard,
        ]}
      >
        <View style={styles.row}>
          <View
            style={[
              styles.imageWrapper,
              showSmallImage && styles.imageWrapperSmall,
            ]}
          >
            {item.sp_thumb ? (
              <Image
                source={{ uri: `${Config.mediaUrl}/${item.sp_thumb}` }}
                style={[styles.image, showSmallImage && styles.imageSmall]}
                contentFit="cover"
                cachePolicy="disk"
              />
            ) : (
              <View
                style={[
                  styles.imagePlaceholder,
                  showSmallImage && styles.imageSmall,
                ]}
              >
                <BirdSVG size={26} color={Colors.textSecondary} />
              </View>
            )}
          </View>

          <View style={styles.content}>
            <View style={styles.titleLeft}>
              <Text style={styles.index}>{index + 1}.</Text>
              <Text
                style={[
                  styles.title,
                  isAllMode && !isSeen && styles.titleUnseen,
                ]}
              >
                {item.sp_name_lang}
              </Text>
              {!isSeen && !isAllMode && (
                <Ionicons
                  name="eye-off-outline"
                  size={13}
                  color={Colors.textSecondary}
                  style={{ marginLeft: 2 }}
                />
              )}
            </View>

            <View style={styles.latinRow}>
              <Text style={[styles.latin, !isSeen && styles.latinUnseen]}>
                {item.sp_latin}
              </Text>
              {isSeen && countriesText && (
                <Text style={styles.flags}>{countriesText}</Text>
              )}
            </View>

            {isSeen && (
              <View style={styles.meta}>
                <View style={styles.metaLeft}>
                  <MetaItem icon="calendar-outline" text={dateText} />
                </View>
                <View style={styles.metaRight}>
                  <View style={styles.seenBadge}>
                    <Ionicons
                      name="eye-outline"
                      size={11}
                      color={Colors.main100}
                    />
                    <Text style={styles.seenBadgeText}>
                      {item.qty_observations}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            {!isSeen && isAllMode && (
              <View style={styles.unseenMeta}>
                <Ionicons
                  name="eye-off-outline"
                  size={12}
                  color={Colors.textSecondary}
                />
                <Text style={styles.unseenHint}>{t("not_observed_yet")}</Text>
              </View>
            )}
          </View>
          {!isSeen && personal && (
            <View style={styles.addIcon}>
              <Ionicons
                name="add-circle-outline"
                size={24}
                color={Colors.textSecondary}
              />
            </View>
          )}
        </View>
      </Pressable>
    );
  },
);

export default StatCard;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 6,
      marginBottom: 4,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardUnseen: {
      backgroundColor: Colors.backgroundMain,
    },

    pressedCard: {
      opacity: 0.85,
    },

    row: {
      flexDirection: "row",
    },

    imageWrapper: {
      width: 56,
      height: 56,
      marginRight: 12,
    },

    image: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },

    imagePlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
      justifyContent: "center",
      alignItems: "center",
    },

    imageWrapperSmall: {
      width: 40,
      height: 40,
      marginRight: 8,
    },

    imageSmall: {
      width: 40,
      height: 40,
    },

    content: {
      flex: 1,
      justifyContent: "flex-start",
    },
    titleLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
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
      lineHeight: 20,
    },

    latinRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 1,
    },

    latin: {
      fontSize: 12,
      fontStyle: "italic",
      color: Colors.statIcon,
    },

    flags: {
      fontSize: 13,
    },

    meta: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: 3,
    },

    metaLeft: {
      flex: 1,
    },

    metaRight: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },

    observations: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.badgeBg,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 10,
      marginBottom: 1,
    },

    observationsText: {
      marginLeft: 2,
      fontSize: 11,
      fontWeight: "600",
      color: Colors.textMain,
    },

    seenBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.main300,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 10,
      marginBottom: 1,
    },

    seenBadgeText: {
      marginLeft: 2,
      fontSize: 11,
      fontWeight: "600",
      color: Colors.main100,
    },
    titleUnseen: {
      color: Colors.textMiddle,
    },

    latinUnseen: {
      color: Colors.statIcon,
    },

    addIcon: {
      justifyContent: "center",
      alignSelf: "stretch",
      paddingLeft: 8,
    },
    unseenMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 3,
    },
    unseenHint: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginLeft: 4,
    },
  });
