import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { normalizeDistance } from "../../util/helpers";
import { Config } from "../../constants/config";
import { NearbyPlace, NearbyPlacesResult } from "../../hooks/Place/useNearbyPlaces";
import { PlaceDropdownItem } from "../../types";

interface NearbyPlaceSuggestionProps extends NearbyPlacesResult {
  /**
   * "picker" is the form's own place section, where nothing has been chosen
   * yet and accepting the suggestion is simply picking a place; "editor" is
   * the place editor, where accepting it means abandoning the place being
   * created. Same layout, different wording — the stakes of the two "no"
   * buttons are not the same.
   */
  variant: "picker" | "editor";
  onSelect: (place: PlaceDropdownItem) => void;
  onDismiss: () => void;
}

const PlaceRow = ({
  candidate,
  onPress,
}: {
  candidate: NearbyPlace;
  onPress?: () => void;
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { place, distanceM } = candidate;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={`nearby-place-option-${place.value}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {/* Only the preview the dropdown payload already carries — never a
          fetch. The whole suggestion has to survive with no connection. */}
      {place.preview ? (
        <Image
          source={{ uri: `${Config.mediaUrl}/${place.preview}` }}
          style={styles.preview}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View style={[styles.preview, styles.previewEmpty]}>
          <Ionicons
            name="location-outline"
            size={20}
            color={Colors.textSecondary}
          />
        </View>
      )}

      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={2}>
          {place.label || place.name}
        </Text>
        <Text style={styles.distance}>{normalizeDistance(distanceM)}</Text>
      </View>

      {onPress && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={Colors.textSecondary}
        />
      )}
    </Pressable>
  );
};

const NearbyPlaceSuggestion = ({
  nearest,
  others,
  isStrong,
  variant,
  onSelect,
  onDismiss,
}: NearbyPlaceSuggestionProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  // The runners-up stay behind one tap in both tones: the nearest place is the
  // answer being proposed, the rest are an escape hatch for when it is wrong.
  const [showOthers, setShowOthers] = useState(false);

  // The reverse-geocode this suggestion waits on is debounced and then goes
  // over the network, so the card lands well after the form has settled —
  // fading it in keeps that from reading as a layout glitch.
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [appear]);

  if (!nearest) return null;

  const title = isStrong
    ? variant === "picker"
      ? t("nearby_place_maybe_here")
      : t("nearby_place_exists_title")
    : t("nearby_place_around_title");

  const rejectLabel =
    variant === "picker"
      ? t("nearby_place_not_it")
      : t("nearby_place_create_anyway");

  return (
    <Animated.View
      testID="nearby-place-suggestion"
      style={[
        styles.card,
        {
          opacity: appear,
          transform: [
            {
              translateY: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [-8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.header}>
        <Ionicons name="location" size={16} color={Colors.main100} />
        <Text style={styles.title}>{title}</Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          testID="nearby-place-dismiss"
          accessibilityLabel={rejectLabel}
        >
          <Ionicons name="close" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Only the strong tone gets buttons, and then the row is a label rather
          than a control — two ways to accept the same suggestion side by side
          is one too many. The quiet tone has no buttons, so its row is the
          control. */}
      <PlaceRow
        candidate={nearest}
        onPress={isStrong ? undefined : () => onSelect(nearest.place)}
      />

      {isStrong && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => onSelect(nearest.place)}
            testID="nearby-place-use"
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.primaryBtnText}>
              {variant === "picker"
                ? t("nearby_place_use_it")
                : t("nearby_place_select_existing")}
            </Text>
          </Pressable>

          <Pressable
            onPress={onDismiss}
            testID="nearby-place-reject"
            style={({ pressed }) => [
              styles.ghostBtn,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.ghostBtnText}>{rejectLabel}</Text>
          </Pressable>
        </View>
      )}

      {showOthers &&
        others.map((candidate) => (
          <PlaceRow
            key={candidate.place.value}
            candidate={candidate}
            onPress={() => onSelect(candidate.place)}
          />
        ))}

      {!showOthers && others.length > 0 && (
        <Pressable
          onPress={() => setShowOthers(true)}
          testID="nearby-place-expand"
          style={({ pressed }) => [styles.moreRow, pressed && styles.btnPressed]}
        >
          <Text style={styles.moreText}>
            {t("nearby_place_more", { count: others.length })}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={Colors.textSecondary}
          />
        </Pressable>
      )}
    </Animated.View>
  );
};

export default NearbyPlaceSuggestion;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: Colors.main100,
      backgroundColor: Colors.main300,
      borderRadius: 12,
      padding: 12,
      gap: 10,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    title: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textMain,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: Colors.primary100,
      borderRadius: 10,
      padding: 8,
    },
    rowPressed: {
      backgroundColor: Colors.primary200,
    },
    preview: {
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: Colors.imageBg,
    },
    previewEmpty: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary300,
    },
    rowText: {
      flex: 1,
    },
    name: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
    },
    distance: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    primaryBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: Colors.main100,
      alignItems: "center",
    },
    primaryBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textOpposite,
    },
    ghostBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: Colors.border,
      alignItems: "center",
    },
    ghostBtnText: {
      fontSize: 14,
      color: Colors.textMain,
    },
    btnPressed: {
      opacity: 0.7,
    },
    moreRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    moreText: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
  });
