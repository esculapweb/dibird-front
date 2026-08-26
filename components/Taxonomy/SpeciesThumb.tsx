import { memo, ReactNode } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { StyleType } from "../../types";
import { BirdSVG } from "../ui/Svgs";
import { resolveTaxonImage, iucnColors, isNotableIucn } from "../../util/taxonomy";

interface SpeciesThumbProps {
  thumb?: string | null;
  size?: number;
  // Each list has its own corner radius; the badge follows it.
  radius?: number;
  style?: StyleType;
  // IUCN category. The badge rides in the corner of the photo rather than
  // next to the name: the row's width belongs to the species name, which gets
  // long, and only the notable categories are shown at all (see
  // isNotableIucn) — on a catalogue of mostly "LC" the badge was pure noise.
  statusCode?: string | null;
  // Turns the thumb into the way to the species page. The rule is the same
  // everywhere in the app: the bird's picture leads to the bird, the rest of
  // the row leads to whatever that row is about — an observation, a filtered
  // list, a menu. Without it the reference was two taps away from every list
  // that shows a bird, and unreachable from several.
  onPress?: () => void;
  testID?: string;
}

const SpeciesThumb = memo(
  ({
    thumb,
    size = 52,
    radius = 10,
    style,
    statusCode,
    onPress,
    testID,
  }: SpeciesThumbProps) => {
    const { t } = useTranslation();
    const { Colors } = useTheme();
    const styles = stylesFn(Colors);
    const uri = resolveTaxonImage(thumb);
    const status = isNotableIucn(statusCode) ? iucnColors(statusCode) : null;

    const content: ReactNode = (
      <>
        {uri ? (
          <Image
            source={{ uri }}
            style={[styles.image, { borderRadius: radius }]}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View
            style={[styles.image, styles.placeholder, { borderRadius: radius }]}
          >
            <BirdSVG size={size / 2} color={Colors.textSecondary} />
          </View>
        )}

        {status && (
          <View style={[styles.badge, { backgroundColor: status.background }]}>
            <Text style={[styles.badgeText, { color: status.text }]}>
              {statusCode}
            </Text>
          </View>
        )}
      </>
    );

    const frame = [
      styles.wrap,
      { width: size, height: size, borderRadius: radius },
      style,
    ];

    // A Pressable without a handler would still swallow the row's own press on
    // the thumb, so the plain View stays the default.
    if (!onPress) return <View style={frame}>{content}</View>;

    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        // What the control does, not the bird it shows — the row it sits in
        // already carries the name. Labelling it with the name instead put two
        // elements reading "African Chaffinch" in the same row, one of which
        // quietly went somewhere else: VoiceOver could not tell them apart,
        // and neither could a Maestro text selector (online-nested-observation
        // tapped the picture and landed on the species page, 2026-08-26).
        accessibilityLabel={t("species_details")}
        testID={testID}
        // Rows are dense and thumbs small (40px in the checklist), so the
        // touch target grows outwards instead of the picture.
        hitSlop={6}
        style={frame}
      >
        {({ pressed }) => (
          <>
            {content}
            {/* The affordance: no permanent icon over the photo, an arrow
                only while the finger is down — the same feedback the
                observation screen's own species header already uses. */}
            {pressed && (
              <View style={[styles.pressOverlay, { borderRadius: radius }]}>
                <Ionicons name="arrow-forward" size={size / 3} color="#fff" />
              </View>
            )}
          </>
        )}
      </Pressable>
    );
  },
);

export default SpeciesThumb;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: Colors.imageBg,
      flexShrink: 0,
    },
    image: {
      width: "100%",
      height: "100%",
    },
    placeholder: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary200,
    },
    badge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      borderRadius: 5,
      paddingHorizontal: 3,
      paddingVertical: 1,
      borderWidth: 1,
      borderColor: Colors.primary100,
    },
    badgeText: {
      fontSize: 9,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    pressOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15, 110, 86, 0.55)",
      justifyContent: "center",
      alignItems: "center",
    },
  });
