import { ReactNode, useMemo, memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import SpeciesThumb from "../Taxonomy/SpeciesThumb";
import { territoryStatusNote } from "../../util/taxonomy";
import { ChecklistItem, StyleType } from "../../types";

const useStyles = (Colors: ThemeColors) =>
  useMemo(() => stylesFn(Colors), [Colors]);

/**
 * The order/family/genus header. A plain View unless the host offers somewhere
 * to go: the personal checklist's headers come from /myapi/checklist2/ and
 * carry no segment, so there a pressable header would be a dead control.
 */
const GroupWrap = ({
  item,
  onGroupPress,
  style,
  pressedStyle,
  children,
}: {
  item: ChecklistItem;
  onGroupPress?: (item: ChecklistItem) => void;
  style: StyleType;
  pressedStyle: StyleType;
  children: ReactNode;
}) => {
  if (!onGroupPress || !item.segment) return <View style={style}>{children}</View>;

  return (
    <Pressable
      onPress={() => onGroupPress(item)}
      accessibilityRole="button"
      style={({ pressed }) => [style, pressed && pressedStyle]}
    >
      {children}
    </Pressable>
  );
};

interface ChecklistCardProps {
  item: ChecklistItem;
  index: number;
  onPress: () => void;
  onToggle: () => void;
  // The bird's picture leads to the species page regardless of what the row
  // itself does — see SpeciesThumb.
  onSpeciesPress?: () => void;
  // Order/family/genus headers lead into the taxon group. Only the country
  // catalogue passes it: the personal checklist's headers come from
  // /myapi/checklist2/ and carry no segment to navigate with.
  onGroupPress?: (item: ChecklistItem) => void;
  // The user's own checklist for a territory: the seen checkbox, the
  // seen/total progress and the dimming of unseen birds. Off on the country
  // catalogue page, which is reference content — a "seen" mark there raises
  // the question "seen when?", which the row has no answer to.
  personal?: boolean;
}

const ChecklistCard = memo(
  ({
    item,
    index,
    onPress,
    onToggle,
    onSpeciesPress,
    onGroupPress,
    personal = true,
  }: ChecklistCardProps) => {
    const { t } = useTranslation();
    const { Colors } = useTheme();
    const styles = useStyles(Colors);
    // Only draw the chevron where the header actually leads somewhere.
    const groupLink = !!onGroupPress && !!item.segment;

    if (item.type === "order") {
      const total = item.total ?? 0;
      const seenCount = item.seen_count ?? 0;
      const isComplete = total > 0 && seenCount >= total;
      const progress = total > 0 ? seenCount / total : 0;

      return (
        <GroupWrap
          item={item}
          onGroupPress={onGroupPress}
          style={[styles.orderDivider, index > 0 && styles.orderDividerSpaced]}
          pressedStyle={styles.groupPressed}
        >
          {index > 0 && <View style={styles.orderTopLine} />}
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
            {total > 0 ? (
              !personal ? (
                <Text style={styles.taxonCount}>{total}</Text>
              ) : isComplete ? (
                <View style={styles.doneBadge}>
                  <Ionicons name="checkmark" size={10} color={Colors.main100} />
                  <Text style={styles.doneBadgeText}>{t("all")}</Text>
                </View>
              ) : (
                <Text style={styles.taxonCount}>
                  {seenCount} / {total}
                </Text>
              )
            ) : null}
            {groupLink && (
              <Ionicons
                name="chevron-forward"
                size={14}
                color={Colors.textSecondary}
                style={[
                  styles.groupChevron,
                  total === 0 && styles.groupChevronAlone,
                ]}
              />
            )}
          </View>
          {personal && total > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  isComplete && styles.progressFillComplete,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
          )}
        </GroupWrap>
      );
    }

    // Genus shares the family's look: the country tree can carry depth-4 rows
    // (see TREE_DEPTH_TYPE in util/fetches.ts), and with no branch of their
    // own they fell through to the species card below — a tap on which opened
    // the species page on a genus segment.
    if (item.type === "family" || item.type === "genus") {
      const total = item.total ?? 0;
      const seenCount = item.seen_count ?? 0;
      const isComplete = total > 0 && seenCount >= total;
      const progress = total > 0 ? seenCount / total : 0;

      return (
        <GroupWrap
          item={item}
          onGroupPress={onGroupPress}
          style={styles.familyWrapper}
          pressedStyle={styles.groupPressed}
        >
          <View style={styles.familyDivider}>
            <Text style={styles.taxonTypeFaded}>{t(item.type)}</Text>
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
              {total > 0 ? (
                !personal ? (
                  <Text style={styles.taxonCount}>{total}</Text>
                ) : isComplete ? (
                  <View style={styles.doneBadge}>
                    <Ionicons
                      name="checkmark"
                      size={10}
                      color={Colors.main100}
                    />
                    <Text style={styles.doneBadgeText}>{t("all")}</Text>
                  </View>
                ) : (
                  <Text style={styles.taxonCount}>
                    {seenCount} / {total}
                  </Text>
                )
              ) : null}
              {groupLink && (
                <Ionicons
                  name="chevron-forward"
                  size={13}
                  color={Colors.textSecondary}
                  style={[
                    styles.groupChevron,
                    total === 0 && styles.groupChevronAlone,
                  ]}
                />
              )}
            </View>
            {personal && total > 0 && (
              <View style={styles.progressTrackThin}>
                <View
                  style={[
                    styles.progressFill,
                    isComplete && styles.progressFillComplete,
                    { width: `${Math.round(progress * 100)}%` },
                  ]}
                />
              </View>
            )}
          </View>
        </GroupWrap>
      );
    }

    // Outside the personal checklist every bird is shown the same way — there
    // is nothing to be "not yet seen" against.
    const isSeen = personal ? item.seen : true;
    // How the bird occurs on this territory ("Rare/Accidental", "Endemic") —
    // worth a line, unlike the values that only spell out the IUCN category.
    const occurrence = territoryStatusNote(item.occurrence, item.status);

    return (
      <View style={[styles.card, !isSeen && styles.cardUnseen]}>
        <Pressable
          style={styles.row}
          onPress={onPress}
          testID={`checklist-species-row-${item.species_id ?? item.id}`}
        >
          <SpeciesThumb
            thumb={item.thumb}
            statusCode={item.status}
            size={40}
            radius={12}
            style={styles.thumb}
            onPress={onSpeciesPress}
            testID={`checklist-species-thumb-${item.species_id ?? item.id}`}
          />

          <View style={styles.content}>
            <Text
              style={[styles.title, !isSeen && styles.titleUnseen]}
              numberOfLines={1}
            >
              {item.name_lang}
            </Text>
            <Text
              style={[styles.latin, !isSeen && styles.latinUnseen]}
              numberOfLines={1}
            >
              {item.latin}
            </Text>
            {!!occurrence && (
              <Text style={styles.occurrence} numberOfLines={1}>
                {occurrence.key ? t(occurrence.key) : occurrence.raw}
              </Text>
            )}
          </View>
        </Pressable>
        {personal ? (
          <Pressable onPress={onToggle} style={styles.addIcon} hitSlop={8}>
            <Ionicons
              name={isSeen ? "checkbox" : "square-outline"}
              size={28}
              color={isSeen ? Colors.main100 : Colors.textSecondary}
            />
          </Pressable>
        ) : (
          // Not styles.addIcon: that one stretches to the card's height, and
          // on a Text (which is what Ionicons renders) the glyph then sits at
          // the top of the stretched box instead of the middle.
          <Ionicons
            name="chevron-forward"
            size={20}
            color={Colors.textSecondary}
            style={styles.chevron}
          />
        )}
      </View>
    );
  },
);

export default ChecklistCard;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
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
    cardUnseen: {
      backgroundColor: Colors.backgroundMain,
    },
    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      minWidth: 0,
    },
    thumb: { marginRight: 8 },
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
      flexShrink: 1,
      minWidth: 0,
    },
    latinUnseen: {
      color: Colors.statIcon,
    },
    occurrence: {
      fontSize: 11,
      color: Colors.main100,
      marginTop: 1,
    },
    addIcon: {
      justifyContent: "center",
      alignSelf: "stretch",
      paddingLeft: 8,
      flexShrink: 0,
    },
    chevron: {
      alignSelf: "center",
      paddingLeft: 8,
      flexShrink: 0,
    },

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

    familyWrapper: {
      flexDirection: "row",
      marginTop: -4,
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

    groupPressed: {
      opacity: 0.6,
    },
    groupChevron: {
      // No marginLeft here: the count (or the "all" badge) already carries the
      // row's only `marginLeft: "auto"`, and a second one would split the free
      // space between the two — which is what left the number floating in the
      // middle of the row instead of sitting by the chevron, the way the genus
      // header does it in TaxonDescendantsList.
      alignSelf: "center",
    },
    // ...unless there is no count at all, and then the chevron is the one that
    // has to be pushed over.
    groupChevronAlone: {
      marginLeft: "auto",
    },

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
      backgroundColor: Colors.main100,
    },
    progressFillComplete: {
      backgroundColor: Colors.main100,
    },

    doneBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderRadius: 20,
      paddingHorizontal: 7,
      paddingVertical: 1,
      marginLeft: "auto",
      flexShrink: 0,
    },
    doneBadgeText: {
      fontSize: 11,
      fontWeight: "600",
      color: Colors.textSecondary,
    },

    taxonLine: {
      height: 0.5,
      backgroundColor: Colors.border,
      marginTop: 6,
    },
    taxonLineFaded: {
      height: 0.5,
      backgroundColor: Colors.border,
      opacity: 0.5,
      marginTop: 4,
    },

    orderTopLine: {
      height: 0.5,
      backgroundColor: Colors.border,
      marginBottom: 10,
    },
  });

// The rank label above a group header is `t(item.type)` — a runtime key, so
// i18next-parser cannot see it. Listed here so the extractor finds both
// variants (see CLAUDE.md).
// t("family")
// t("genus")
