import { memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { BirdSVG } from "../ui/Svgs";
import { resolveTaxonImage, iucnColors, isNotableIucn } from "../../util/taxonomy";

// Three to a row on a phone: at two the grid is just the row list with the
// text taken away, at four the birds stop being recognisable.
export const PHOTO_GRID_COLUMNS = 3;

interface SpeciesTileProps {
  title: string;
  thumb?: string | null;
  // IUCN category, same rule as SpeciesThumb: only the notable ones get a badge.
  statusCode?: string | null;
  // The website's "Species names" switch. The badge and the seen mark stay
  // either way — they are state, not a caption.
  showCaption?: boolean;
  onPress: () => void;
  // The personal lists (stats, checklist): unseen birds are dimmed, and the
  // corner mark is its own control — the same split as the row's checkbox
  // next to the row's menu.
  seen?: boolean;
  onToggleSeen?: () => void;
  testID?: string;
}

const SpeciesTile = memo(
  ({
    title,
    thumb,
    statusCode,
    showCaption = true,
    onPress,
    seen,
    onToggleSeen,
    testID,
  }: SpeciesTileProps) => {
    const { Colors } = useTheme();
    const styles = stylesFn(Colors);
    const uri = resolveTaxonImage(thumb);
    const status = isNotableIucn(statusCode) ? iucnColors(statusCode) : null;
    const dimmed = seen === false;

    return (
      <View style={styles.tile}>
        <Pressable
          onPress={onPress}
          // The name is always the label, caption or not: with captions off
          // the tile is still "Osprey" to VoiceOver and to a Maestro text
          // selector, not an anonymous picture.
          accessibilityRole="button"
          accessibilityLabel={title}
          testID={testID}
          style={({ pressed }) => [
            styles.frame,
            dimmed && styles.dimmed,
            pressed && styles.pressed,
          ]}
        >
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="disk"
              recyclingKey={uri}
            />
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              <BirdSVG size={32} color={Colors.textSecondary} />
            </View>
          )}

          {showCaption && (
            <View style={styles.caption}>
              <Text style={styles.captionText} numberOfLines={2}>
                {title}
              </Text>
            </View>
          )}

          {status && (
            <View style={[styles.badge, { backgroundColor: status.background }]}>
              <Text style={[styles.badgeText, { color: status.text }]}>
                {statusCode}
              </Text>
            </View>
          )}
        </Pressable>

        {onToggleSeen && (
          // A sibling of the tile's Pressable, not a child: nested, the outer
          // one would still take the press on some Android versions.
          <Pressable
            onPress={onToggleSeen}
            hitSlop={8}
            style={styles.seenMark}
            testID={testID ? `${testID}-seen` : undefined}
          >
            {seen ? (
              // A filled disc with a separate tick, not "checkmark-circle":
              // that icon's tick is a cutout, so a dark photo shows through it
              // and the mark disappears.
              <View style={styles.seenDisc}>
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={Colors.textOpposite}
                />
              </View>
            ) : (
              <Ionicons name="ellipse-outline" size={24} color="#fff" />
            )}
          </Pressable>
        )}
      </View>
    );
  },
);

export default SpeciesTile;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    tile: { width: "100%", aspectRatio: 1 },
    frame: {
      flex: 1,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: Colors.imageBg,
    },
    dimmed: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
    image: { width: "100%", height: "100%" },
    placeholder: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary200,
    },
    caption: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 6,
      paddingVertical: 4,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    captionText: {
      fontSize: 11,
      fontWeight: "600",
      color: "#fff",
    },
    badge: {
      position: "absolute",
      top: 4,
      left: 4,
      borderRadius: 5,
      paddingHorizontal: 3,
      paddingVertical: 1,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    seenMark: {
      position: "absolute",
      top: 3,
      right: 3,
      borderRadius: 12,
      backgroundColor: "rgba(0, 0, 0, 0.25)",
    },
    seenDisc: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.main100,
    },
  });
