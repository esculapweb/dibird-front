import { StyleSheet, Text, Pressable, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { fetchTerritoryRegions } from "../../util/fetches";
import { StaleTime } from "../../constants/staleTime";
import { useLanguage } from "../../store/language-context";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { TerritoryRegionOption } from "../../types";

interface RegionFilterChipsProps {
  value: number | null;
  onChange: (region: number | null) => void;
}

// A single-choice row of regions above the country list. Twenty-two options
// with one-tap switching don't earn a bottom sheet the way the species trait
// filters do — a horizontal strip keeps the current choice visible without
// hiding the list behind a sheet.
const RegionFilterChips = ({ value, onChange }: RegionFilterChipsProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { language } = useLanguage();
  const styles = stylesFn(Colors);

  const { data } = useQuery<TerritoryRegionOption[]>({
    queryKey: ["TerritoryRegions", language],
    queryFn: fetchTerritoryRegions,
    staleTime: StaleTime.ONE_DAY,
  });

  // Nothing to choose between until the list is in — the strip would just be
  // a lone "All" chip that does nothing.
  if (!data || data.length === 0) return null;

  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      testID={`region-chip-${key}`}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.stripContent}
      testID="region-chips"
    >
      {chip("all", t("all"), value == null, () => onChange(null))}
      {data.map((region) =>
        chip(String(region.id), region.label, value === region.id, () =>
          // Tapping the active region clears it, so the strip needs no
          // separate reset control.
          onChange(value === region.id ? null : region.id),
        ),
      )}
    </ScrollView>
  );
};

export default RegionFilterChips;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    strip: { marginHorizontal: -12, marginBottom: 8 },
    stripContent: { paddingHorizontal: 12, gap: 6 },
    chip: {
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: Colors.primary100,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    chipActive: {
      backgroundColor: Colors.main300,
      borderColor: Colors.main100,
    },
    chipText: {
      fontSize: 13,
      color: Colors.textMiddle,
    },
    chipTextActive: {
      color: Colors.main100,
      fontWeight: "600",
    },
  });
