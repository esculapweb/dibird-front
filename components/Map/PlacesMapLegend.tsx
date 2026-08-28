import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import {
  MapSymbolScale,
  SYMBOL_STROKE_WIDTH,
  SymbolSizeClass,
  maxOuterRadius,
  outerRadius,
} from "../../constants/mapSymbolScale";

interface PlacesMapLegendProps {
  scale: MapSymbolScale;
  expanded: boolean;
  onToggle: () => void;
}

// "1-1" would be silly for a class holding a single value.
const rangeLabel = (sizeClass: SymbolSizeClass, andMore: string) => {
  if (sizeClass.to == null) return andMore;
  if (sizeClass.to === sizeClass.from) return `${sizeClass.from}`;
  return `${sizeClass.from}\u2013${sizeClass.to}`;
};

/**
 * States the size classes the map draws. Nothing on the map carries a number
 * (see PlacesMap on why there are no labels), so this is the only place
 * the sizes get their meaning.
 *
 * Collapsed to a button by default. Shown outright it took a corner of the map
 * permanently and pulled the eye away from the data — and it is reference
 * material, wanted once and then not again, which is exactly what a map
 * control is for. Expanding costs one tap; the map dismisses it on the next
 * tap anywhere.
 *
 * The open panel lays the classes out as a row of graduated symbols rather
 * than the more compact nested rings: at these radii the classes are 4-5 px
 * apart, and stacked labels collided at any font small enough for an overlay.
 */
const PlacesMapLegend = ({
  scale,
  expanded,
  onToggle,
}: PlacesMapLegendProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors, maxOuterRadius(scale));
  const { t } = useTranslation();

  if (!expanded) {
    return (
      <Pressable
        style={styles.button}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={t("map_legend_show")}
        testID="observations-map-legend-toggle"
      >
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={Colors.textSecondary}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.panel}
      onPress={onToggle}
      accessibilityRole="button"
      testID="observations-map-legend"
    >
      <Text style={styles.title}>{t(scale.titleKey)}</Text>

      <View style={styles.row}>
        {scale.classes.map((sizeClass) => (
          <View key={sizeClass.from} style={styles.cell}>
            {/* Fixed-height box with the dot pinned to its bottom, so the
                circles sit on one baseline and only grow upward. */}
            <View style={styles.dotBox}>
              {/* Sized by the outer radius, with the ring drawn inward, so the
                  coloured core ends up exactly circle-radius across and the
                  whole symbol matches what MapLibre paints (see outerRadius). */}
              <View
                testID={`observations-map-legend-dot-${sizeClass.from}`}
                style={[
                  styles.dot,
                  {
                    width: outerRadius(sizeClass.radius) * 2,
                    height: outerRadius(sizeClass.radius) * 2,
                    borderRadius: outerRadius(sizeClass.radius),
                  },
                ]}
              />
            </View>
            <Text style={styles.label}>
              {rangeLabel(
                sizeClass,
                t("map_legend_from", { count: sizeClass.from }),
              )}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
};

export default PlacesMapLegend;

const stylesFn = (Colors: ThemeColors, maxRadius: number) =>
  StyleSheet.create({
    button: {
      position: "absolute",
      top: 12,
      left: 12,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.overlayBg,
    },
    panel: {
      position: "absolute",
      top: 12,
      left: 12,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: Colors.overlayBg,
    },
    title: {
      fontSize: 10,
      fontWeight: "600",
      color: Colors.textSecondary,
      marginBottom: 6,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 10,
    },
    cell: {
      alignItems: "center",
    },
    dotBox: {
      height: maxRadius * 2,
      justifyContent: "flex-end",
    },
    dot: {
      borderWidth: SYMBOL_STROKE_WIDTH,
      borderColor: Colors.placeDotStroke,
      backgroundColor: Colors.placeDotFill,
    },
    label: {
      marginTop: 4,
      fontSize: 9,
      color: Colors.textSecondary,
    },
  });
