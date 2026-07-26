import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";

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
}

const SpeciesThumb = memo(
  ({ thumb, size = 52, radius = 10, style, statusCode }: SpeciesThumbProps) => {
    const { Colors } = useTheme();
    const styles = stylesFn(Colors);
    const uri = resolveTaxonImage(thumb);
    const status = isNotableIucn(statusCode) ? iucnColors(statusCode) : null;

    return (
      <View
        style={[
          styles.wrap,
          { width: size, height: size, borderRadius: radius },
          style,
        ]}
      >
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
      </View>
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
  });
