import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";

import { Config } from "../../constants/config";
import { useTheme } from "../../store/theme-context";
import { BirdSVG } from "../ui/Svgs";

const useStyles = (Colors) => React.useMemo(() => stylesFn(Colors), [Colors]);

const ChecklistCard = React.memo(({ item, index, seenMode, onPress }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = useStyles(Colors);

  const isAllMode = seenMode === "all";

  if (item.type === "order") {
    const total = item.total ?? 0;
    const seenCount = item.seen_count ?? 0;
    const isComplete = total > 0 && seenCount >= total;
    const progress = total > 0 ? seenCount / total : 0;

    return (
      <View style={[styles.orderDivider, index > 0 && styles.orderDividerSpaced]}>
        <Text style={styles.taxonType}>{t("order")}</Text>
        <View style={styles.taxonRow}>
          <Text style={styles.orderName} numberOfLines={1}>
            {item.name_lang}
          </Text>
          {item.latin ? (
            <>
              <Text style={styles.taxonDot}>·</Text>
              <Text style={styles.taxonLatin} numberOfLines={1}>
                {item.latin}
              </Text>
            </>
          ) : null}
          {isAllMode && total > 0 ? (
            isComplete ? (
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark" size={10} color={Colors.successText} />
                <Text style={styles.doneBadgeText}>{t("all")}</Text>
              </View>
            ) : (
              <Text style={styles.taxonCount}>{seenCount} / {total}</Text>
            )
          ) : null}
        </View>
        {isAllMode && total > 0 && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, isComplete && styles.progressFillComplete, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        )}
      </View>
    );
  }

  if (item.type === "family") {
    const total = item.total ?? 0;
    const seenCount = item.seen_count ?? 0;
    const isComplete = total > 0 && seenCount >= total;
    const progress = total > 0 ? seenCount / total : 0;

    return (
      <View style={[styles.familyWrapper, index > 0 && styles.familyWrapperSpaced]}>
        <View style={styles.familyDivider}>
          <Text style={styles.taxonTypeFaded}>{t("family")}</Text>
          <View style={styles.taxonRow}>
            <Text style={styles.familyName} numberOfLines={1}>
              {item.name_lang}
            </Text>
            {item.latin ? (
              <>
                <Text style={styles.taxonDot}>·</Text>
                <Text style={styles.taxonLatin} numberOfLines={1}>
                  {item.latin}
                </Text>
              </>
            ) : null}
            {isAllMode && total > 0 ? (
              isComplete ? (
                <View style={styles.doneBadge}>
                  <Ionicons name="checkmark" size={10} color={Colors.seenIcon} />
                  <Text style={styles.doneBadgeText}>{t("all")}</Text>
                </View>
              ) : (
                <Text style={styles.taxonCount}>{seenCount} / {total}</Text>
              )
            ) : null}
          </View>
          {isAllMode && total > 0 && (
            <View style={styles.progressTrackThin}>
              <View style={[styles.progressFill, isComplete && styles.progressFillComplete, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          )}
        </View>
      </View>
    );
  }

  const isSeen = item.seen;

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
        <View style={styles.imageWrapper}>
          {item.thumb ? (
            <Image
              source={{ uri: `${Config.mediaUrl}/${item.thumb}` }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <BirdSVG size={26} color={Colors.textSecondary} />
            </View>
          )}
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, isAllMode && !isSeen && styles.titleUnseen]} numberOfLines={1}>
            {item.name_lang}
          </Text>
          <Text style={[styles.latin, !isSeen && styles.latinUnseen]} numberOfLines={1}>
            {item.latin}
          </Text>
        </View>
        <View style={styles.addIcon}>
          <Ionicons
            name={isSeen ? "checkbox" : "square-outline"}
            size={28}
            color={isSeen ? Colors.tabActiveColor : Colors.textSecondary}
          />
        </View>
      </View>
    </Pressable>
  );
});

export default ChecklistCard;

const stylesFn = (Colors) =>
  StyleSheet.create({
    // Species card
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 6,
      marginBottom: 4,
      marginLeft: 12,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    pressedCard: {
      opacity: 0.85,
    },
    cardUnseen: {
      backgroundColor: Colors.unseenCardBg,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
    },
    imageWrapper: {
      width: 40,
      height: 40,
      marginRight: 8,
    },
    image: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },
    imagePlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      flex: 1,
      justifyContent: "center",
      minWidth: 0,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      lineHeight: 20,
    },
    titleUnseen: {
      color: Colors.textSecondary,
    },
    latin: {
      fontSize: 12,
      fontStyle: "italic",
      color: Colors.statIcon,
      marginTop: 1,
    },
    latinUnseen: {
      color: Colors.statIcon,
    },
    addIcon: {
      justifyContent: "center",
      alignSelf: "stretch",
      paddingLeft: 8,
    },

    // Order divider
    orderDivider: {
      paddingTop: 10,
      paddingBottom: 4,
      paddingHorizontal: 2,
      marginBottom: 4,
    },
    orderDividerSpaced: {
      marginTop: 16,
    },
    orderName: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      flexShrink: 0,
    },

    // Family wrapper — row with vertical line + content
    familyWrapper: {
      flexDirection: "row",
      marginBottom: 2,
      marginLeft: 8,
    },
    familyDivider: {
      flex: 1,
      paddingVertical: 10,
      paddingRight: 2,
      minWidth: 0,
    },
    familyName: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textMain,
      flexShrink: 0,
    },

    // Shared taxon styles
    taxonType: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      color: Colors.textSecondary,
      marginBottom: 3,
    },
    taxonTypeFaded: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      color: Colors.textSecondary,
      opacity: 0.65,
      marginBottom: 2,
    },
    taxonRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 5,
    },
    taxonDot: {
      fontSize: 12,
      color: Colors.textSecondary,
      flexShrink: 0,
    },
    taxonLatin: {
      fontSize: 11,
      fontStyle: "italic",
      color: Colors.textSecondary,
      flexShrink: 1,
      minWidth: 0,
    },
    taxonCount: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginLeft: "auto",
      paddingLeft: 8,
      flexShrink: 0,
    },

    // Progress bars
    progressTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: Colors.border,
      overflow: "hidden",
      marginTop: 5,
    },
    progressTrackThin: {
      height: 2,
      borderRadius: 1,
      backgroundColor: Colors.border,
      overflow: "hidden",
      marginTop: 4,
    },
    progressFill: {
      height: "100%",
      borderRadius: 2,
      backgroundColor: Colors.seenIcon,
    },
    progressFillComplete: {
      backgroundColor: Colors.seenIcon,
    },

    // Completion badge
    doneBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: Colors.seenBadgeBg,
      borderRadius: 20,
      paddingHorizontal: 7,
      paddingVertical: 1,
      marginLeft: "auto",
      flexShrink: 0,
    },
    doneBadgeText: {
      fontSize: 10,
      fontWeight: "600",
      color: Colors.seenIcon,
    },

    // Divider lines
    taxonLine: {
      height: 0.5,
      backgroundColor: Colors.border,
      marginTop: 5,
    },
    taxonLineFaded: {
      height: 0.5,
      backgroundColor: Colors.border,
      opacity: 0.5,
      marginTop: 4,
    },
  });
