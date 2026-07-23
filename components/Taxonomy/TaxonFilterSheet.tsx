import { useState } from "react";
import { View, Text, StyleSheet, Pressable, LayoutAnimation } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";

import LoadingOverlay from "../ui/LoadingOverlay";
import DropdownInput from "../ui/DropdownInput";
import { fetchTraitFilters, fetchMyCountries } from "../../util/fetches";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { StaleTime } from "../../constants/staleTime";
import { useLanguage } from "../../store/language-context";
import { useTheme, ThemeColors } from "../../store/theme-context";
import {
  TaxonTraitFilters,
  TraitFilterOption,
  TraitFilterOptions,
} from "../../types";
import {
  Bucket,
  VocabularyKey,
  GROUPS,
  matchesBucket,
  vocabLabels,
  hasTraitFilters,
} from "./taxonTraitConfig";

// Re-exported so existing importers (TaxonomyScreen, tests) keep pulling it
// from the sheet; the definition now lives in the shared config module.
export { hasTraitFilters };

interface TaxonFilterSheetProps {
  value: TaxonTraitFilters;
  onApply: (filters: TaxonTraitFilters) => void;
  dismiss: () => void;
}

// Everything lives inside the one BottomSheetScrollView on purpose. With
// `enableDynamicSizing`, BottomSheetView and BottomSheetScrollView both write
// the sheet's height into the same `contentHeight` — last writer wins — so a
// sheet built from the shared title block plus a scroll view plus a plain
// footer view ends up sized by whichever reported last (usually the ~60px
// title), which is why the sheet opened far shorter than its content. One
// measured node means the sheet is exactly as tall as what's in it.

const TaxonFilterSheet = ({
  value,
  onApply,
  dismiss,
}: TaxonFilterSheetProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, insets);
  const [draft, setDraft] = useState<TaxonTraitFilters>(value);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: options, isLoading } = useQuery<TraitFilterOptions>({
    queryKey: ["TraitFilters", language],
    queryFn: fetchTraitFilters,
    staleTime: StaleTime.ONE_DAY,
  });

  // Country distribution filter — same dropdown the diary/place filters use.
  const {
    query: countriesQuery,
    sort: countriesSort,
    onSortChange: onCountriesSortChange,
  } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
  });

  // One open group at a time, so the sheet never grows past a screenful.
  const toggleGroup = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => (prev === id ? null : id));
  };

  const toggleValue = (key: VocabularyKey, option: string) =>
    setDraft((prev) => {
      const selected = prev[key] ?? [];
      return {
        ...prev,
        [key]: selected.includes(option)
          ? selected.filter((v) => v !== option)
          : [...selected, option],
      };
    });

  const toggleBucket = (bucket: Bucket) =>
    setDraft((prev) => {
      const isActive = matchesBucket(prev, bucket);
      const cleared = { ...prev };
      for (const key of Object.keys(bucket)) {
        if (key !== "labelKey") delete cleared[key as "mass_min"];
      }
      if (isActive) return cleared;
      return {
        ...cleared,
        ...Object.fromEntries(
          Object.entries(bucket).filter(
            ([key, bound]) => key !== "labelKey" && bound != null,
          ),
        ),
      };
    });

  // What the collapsed row shows on the right — the whole point of folding
  // the groups away is still seeing what is switched on.
  const summary = (group: (typeof GROUPS)[number]) => {
    if ("buckets" in group) {
      const active = group.buckets.find((bucket) => matchesBucket(draft, bucket));
      return active ? t(active.labelKey) : "";
    }

    const selected = draft[group.vocabulary] ?? [];
    if (selected.length === 0) return "";

    const labels = vocabLabels(options?.[group.vocabulary], selected);

    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
  };

  const chip = (
    key: string,
    label: string,
    active: boolean,
    onPress: () => void,
    count?: number,
  ) => (
    <Pressable
      key={key}
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
      {count != null && <Text style={styles.chipCount}>{count}</Text>}
    </Pressable>
  );

  if (isLoading || !options) return <LoadingOverlay />;

  return (
    <BottomSheetScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("filters")}</Text>
        {hasTraitFilters(draft) && (
          <Pressable onPress={() => setDraft({})} hitSlop={8}>
            <Text style={styles.reset}>{t("reset_filters")}</Text>
          </Pressable>
        )}
      </View>

      <DropdownInput
        title={t("country")}
        placeholder={t("all_countries")}
        value={draft.territory ?? null}
        setValue={(value) =>
          setDraft((prev) => ({ ...prev, territory: value }))
        }
        query={countriesQuery}
        type="CountriesDropdown"
        sort={countriesSort}
        onSortChange={onCountriesSortChange}
        allowReset
      />

      {GROUPS.map((group) => {
          const list: TraitFilterOption[] =
            "vocabulary" in group ? (options[group.vocabulary] ?? []) : [];
          if ("vocabulary" in group && list.length === 0) return null;

          const isOpen = expanded === group.id;
          const groupSummary = summary(group);

        return (
          <View key={group.id} style={styles.group}>
              <Pressable
                style={styles.groupHeader}
                onPress={() => toggleGroup(group.id)}
                testID={`filter-group-${group.id}`}
              >
                <Text style={styles.groupTitle}>{t(group.labelKey)}</Text>
                <Text style={styles.groupSummary} numberOfLines={1}>
                  {groupSummary || "—"}
                </Text>
                <Ionicons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={Colors.textSecondary}
                />
              </Pressable>

              {isOpen && (
                <View style={styles.chipsRow}>
                  {"buckets" in group
                    ? group.buckets.map((bucket) =>
                        chip(
                          bucket.labelKey,
                          t(bucket.labelKey),
                          matchesBucket(draft, bucket),
                          () => toggleBucket(bucket),
                        ),
                      )
                    : list.map((option) =>
                        chip(
                          `${group.vocabulary}-${option.value}`,
                          option.label,
                          (draft[group.vocabulary] ?? []).includes(option.value),
                          () => toggleValue(group.vocabulary, option.value),
                          option.count,
                        ),
                      )}
                </View>
              )}
          </View>
        );
      })}

      <Pressable
        style={styles.applyButton}
        onPress={() => {
          onApply(draft);
          dismiss();
        }}
      >
        <Text style={styles.applyText}>{t("apply")}</Text>
      </Pressable>
    </BottomSheetScrollView>
  );
};

export default TaxonFilterSheet;

const stylesFn = (Colors: ThemeColors, insets: EdgeInsets) =>
  StyleSheet.create({
    scroll: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 680,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: Math.max(20, insets.bottom),
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: Colors.textMain,
    },
    reset: { fontSize: 14, color: Colors.main100 },
    group: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.divider,
    },
    groupHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 14,
    },
    groupTitle: {
      fontSize: 15,
      color: Colors.textMain,
    },
    groupSummary: {
      flex: 1,
      fontSize: 13,
      color: Colors.main100,
      textAlign: "right",
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingBottom: 14,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipActive: {
      backgroundColor: Colors.main300,
      borderColor: Colors.main100,
    },
    chipText: { fontSize: 13, color: Colors.textMain },
    chipTextActive: { color: Colors.main100, fontWeight: "600" },
    chipCount: { fontSize: 11, color: Colors.textSecondary },
    applyButton: {
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      height: 48,
      marginTop: 20,
      paddingHorizontal: 40,
      backgroundColor: Colors.main100,
      borderRadius: 8,
    },
    applyText: {
      fontWeight: "600",
      fontSize: 16,
      color: Colors.textOpposite,
    },
  });
