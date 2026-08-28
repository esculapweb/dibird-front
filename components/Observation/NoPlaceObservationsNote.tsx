import { StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { fetchNoPlaceObservationCount } from "../../util/fetches";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { stableStringify } from "../../util/helpers";
import { Filters } from "../../types";

interface NoPlaceObservationsNoteProps {
  filters: Filters | null;
}

/**
 * An observation without a place has no coordinates, so the map cannot draw it
 * at all. Left unsaid, that reads as data loss — the map would quietly show
 * fewer observations than the list for the same filters. This says how many.
 *
 * Deliberately quiet: it renders nothing while loading, on error (offline is
 * the common case — the map beside it still paints from cache) or when there
 * is nothing missing.
 */
const NoPlaceObservationsNote = ({ filters }: NoPlaceObservationsNoteProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t, i18n } = useTranslation();

  const { data } = useQuery({
    queryKey: [
      "ObservationsNoPlaceCount",
      stableStringify({ ...(filters ?? {}) }),
      i18n.language,
    ],
    queryFn: () => fetchNoPlaceObservationCount(filters ?? {}),
    retry: false,
  });

  if (!data) return null;

  return (
    <View style={styles.container} testID="observations-no-place-note">
      <Ionicons
        name="help-circle-outline"
        size={14}
        color={Colors.textSecondary}
      />
      <Text style={styles.text}>
        {t("map_observations_without_place", { count: data })}
      </Text>
    </View>
  );
};

export default NoPlaceObservationsNote;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: Colors.overlayBg,
    },
    text: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
  });
