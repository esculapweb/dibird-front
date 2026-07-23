import { ScrollView, View, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { useLanguage } from "../../store/language-context";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { fetchTraitFilters, fetchMyCountries } from "../../util/fetches";
import { StaleTime } from "../../constants/staleTime";
import { GROUPS, matchesBucket, vocabLabels } from "./taxonTraitConfig";
import { TaxonTraitFilters, TraitFilterOptions } from "../../types";

interface TaxonFilterChipsProps {
  traits: TaxonTraitFilters;
  onChange: (next: TaxonTraitFilters) => void;
}

// A removable chip: `name: value`, and `clear` returns the traits with this
// one filter dropped (a whole group at a time, matching one chip per group).
interface Chip {
  id: string;
  name: string;
  value: string;
  clear: (traits: TaxonTraitFilters) => TaxonTraitFilters;
}

// Mirrors FilterChips (the global filters row), but over TaxonTraitFilters —
// which FilterChips/useFilterLabels don't understand (mass buckets, trait
// vocabularies). Labels are built from the same shared config the sheet uses.
const TaxonFilterChips = ({ traits, onChange }: TaxonFilterChipsProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { language } = useLanguage();
  const styles = stylesFn(Colors);

  // Both queries share their cache with the filter sheet (same keys), so this
  // row costs no extra request once the sheet has been opened once.
  const { data: options } = useQuery<TraitFilterOptions>({
    queryKey: ["TraitFilters", language],
    queryFn: fetchTraitFilters,
    staleTime: StaleTime.ONE_DAY,
  });

  const { query: countriesQuery } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
    mapResult: true,
  });

  const chips: Chip[] = [];

  if (traits.territory != null) {
    chips.push({
      id: "territory",
      name: t("country"),
      value: countriesQuery.data?.get(traits.territory) ?? "…",
      clear: ({ territory: _territory, ...rest }) => rest,
    });
  }

  for (const group of GROUPS) {
    if ("buckets" in group) {
      const active = group.buckets.find((bucket) => matchesBucket(traits, bucket));
      if (!active) continue;
      chips.push({
        id: group.id,
        name: t(group.labelKey),
        value: t(active.labelKey),
        clear: (current) => {
          const next = { ...current };
          for (const key of Object.keys(active)) {
            if (key !== "labelKey") delete next[key as "mass_min"];
          }
          return next;
        },
      });
    } else {
      const selected = traits[group.vocabulary] ?? [];
      if (selected.length === 0) continue;
      chips.push({
        id: group.id,
        name: t(group.labelKey),
        value: vocabLabels(options?.[group.vocabulary], selected).join(", ") || "…",
        clear: (current) => {
          const next = { ...current };
          delete next[group.vocabulary];
          return next;
        },
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {chips.map((chip) => (
          <View key={chip.id} style={styles.filterChip}>
            <Text
              style={styles.filterText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              <Text style={styles.filterLabel}>{chip.name}: </Text>
              <Text style={styles.filterValue}>{chip.value}</Text>
            </Text>
            <View style={styles.removeIcon}>
              <Pressable
                onPress={() => onChange(chip.clear(traits))}
                hitSlop={8}
                testID={`remove-taxon-filter-${chip.id}`}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={Colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default TaxonFilterChips;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: {
      paddingTop: 10,
      paddingBottom: 8,
    },
    scrollContainer: {
      alignItems: "center",
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.primary100,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: Colors.border,
      maxWidth: 300,
    },
    filterText: {
      fontSize: 12,
      lineHeight: 16,
      flexShrink: 1,
      marginRight: 4,
    },
    filterLabel: {
      fontSize: 11,
      color: Colors.textSecondary,
      fontWeight: "400",
    },
    filterValue: {
      fontSize: 12,
      color: Colors.textMain,
      fontWeight: "600",
    },
    removeIcon: {
      marginLeft: 4,
      justifyContent: "center",
      alignItems: "center",
    },
  });
