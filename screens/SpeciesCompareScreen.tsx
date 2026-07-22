import { useLayoutEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import Layout from "../components/ui/Layout";
import Section from "../components/ui/Section";
import EmptyState from "../components/Empty/EmptyState";
import { BirdSVG } from "../components/ui/Svgs";
import { fetchTaxonDetail } from "../util/fetches";
import { resolveTaxonImage, iucnColors } from "../util/taxonomy";
import { setNavigationCallback } from "../util/navigationCallbacks";
import { StaleTime } from "../constants/staleTime";
import { useLanguage } from "../store/language-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  TaxonListItem,
  TaxonSpeciesDetail,
  TaxonTrait,
} from "../types";

type Side = "a" | "b";

interface CompareRow {
  key: string;
  label: string;
  a: TaxonTrait | null;
  b: TaxonTrait | null;
}

const SpeciesCompareScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { language } = useLanguage();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"SpeciesCompare">>();
  const [segments, setSegments] = useState<Record<Side, string | null>>({
    a: route.params?.segmentA ?? null,
    b: route.params?.segmentB ?? null,
  });

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("compare_species") });
  }, [navigation, t]);

  // The same query the species page uses, so a species already opened is
  // compared straight from the cache (and works offline).
  const queryA = useQuery<TaxonSpeciesDetail>({
    queryKey: ["TaxonSpeciesDetail", segments.a, language],
    queryFn: () => fetchTaxonDetail<TaxonSpeciesDetail>(segments.a as string, 5),
    enabled: !!segments.a,
    staleTime: StaleTime.ONE_DAY,
  });

  const queryB = useQuery<TaxonSpeciesDetail>({
    queryKey: ["TaxonSpeciesDetail", segments.b, language],
    queryFn: () => fetchTaxonDetail<TaxonSpeciesDetail>(segments.b as string, 5),
    enabled: !!segments.b,
    staleTime: StaleTime.ONE_DAY,
  });

  const pickSpecies = (side: Side) => {
    const key = `species-compare-${side}`;
    setNavigationCallback(key, (item) => {
      setSegments((prev) => ({ ...prev, [side]: (item as TaxonListItem).segment }));
    });
    navigation.push("Taxonomy", {
      rank: 5,
      title: t("pick_species"),
      focusSearch: true,
      pickerKey: key,
    });
  };

  // One row per trait either species has, in the backend's grouping order,
  // so the two columns always line up even when a value is missing.
  const groups = useMemo(() => {
    const source = queryA.data?.traits ?? queryB.data?.traits ?? [];
    const byKey = (detail?: TaxonSpeciesDetail) => {
      const map = new Map<string, TaxonTrait>();
      for (const group of detail?.traits ?? []) {
        for (const trait of group.traits) map.set(trait.key, trait);
      }
      return map;
    };

    const traitsA = byKey(queryA.data);
    const traitsB = byKey(queryB.data);
    const keys = new Set([...traitsA.keys(), ...traitsB.keys()]);

    return source
      .map((group) => ({
        key: group.key,
        label: group.label,
        rows: group.traits
          .filter((trait) => keys.has(trait.key))
          .map<CompareRow>((trait) => ({
            key: trait.key,
            label: trait.label,
            a: traitsA.get(trait.key) ?? null,
            b: traitsB.get(trait.key) ?? null,
          })),
      }))
      .filter((group) => group.rows.length > 0);
  }, [queryA.data, queryB.data]);

  const speciesCard = (side: Side, detail?: TaxonSpeciesDetail) => {
    const thumb = resolveTaxonImage(detail?.photos?.[0]?.thumb);
    const status = iucnColors(detail?.status?.status_id);

    return (
      <Pressable
        style={styles.pickerCard}
        onPress={() => pickSpecies(side)}
        testID={`compare-pick-${side}`}
      >
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={styles.pickerThumb}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View style={[styles.pickerThumb, styles.pickerThumbEmpty]}>
            {detail ? (
              <BirdSVG size={28} color={Colors.textSecondary} />
            ) : (
              <Ionicons name="add" size={26} color={Colors.main100} />
            )}
          </View>
        )}

        <Text style={styles.pickerName} numberOfLines={2}>
          {detail?.name_lang ?? t("pick_species")}
        </Text>
        {!!detail && (
          <Text style={styles.pickerLatin} numberOfLines={1}>
            {detail.latin_name}
          </Text>
        )}
        {!!detail?.status && (
          <View
            style={[
              styles.pickerStatus,
              status && { backgroundColor: status.background },
            ]}
          >
            <Text style={[styles.pickerStatusText, status && { color: status.text }]}>
              {detail.status.status_id}
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  // Only numeric traits can have a winner, and only when both sides have one.
  const bigger = (row: CompareRow): Side | null => {
    if (row.a?.num == null || row.b?.num == null) return null;
    if (row.a.num === row.b.num) return null;
    return row.a.num > row.b.num ? "a" : "b";
  };

  const bothChosen = !!segments.a && !!segments.b;
  const bothLoaded = !!queryA.data && !!queryB.data;

  return (
    <Layout style={styles.layout} withScroll={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        testID="compare-scroll"
        refreshControl={
          <RefreshControl
            refreshing={queryA.isRefetching || queryB.isRefetching}
            onRefresh={() => {
              queryA.refetch();
              queryB.refetch();
            }}
            tintColor={Colors.main100}
            colors={[Colors.main100]}
          />
        }
      >
        <View style={styles.pickerRow}>
          {speciesCard("a", queryA.data)}
          <Text style={styles.versus}>vs</Text>
          {speciesCard("b", queryB.data)}
        </View>

        {!bothChosen && (
          <EmptyState icon="git-compare-outline" message={t("compare_hint")} />
        )}

        {bothChosen && bothLoaded && groups.length === 0 && (
          <EmptyState
            icon="alert-circle-outline"
            message={t("no_traits_to_compare")}
          />
        )}

        {groups.map((group) => (
          <Section key={group.key} title={group.label}>
            {group.rows.map((row) => {
              const winner = bigger(row);
              return (
                <View key={row.key} style={styles.row}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <View style={styles.rowValues}>
                    <Text
                      style={[
                        styles.rowValue,
                        winner === "a" && styles.rowValueBigger,
                      ]}
                    >
                      {row.a?.value ?? "—"}
                    </Text>
                    <Text
                      style={[
                        styles.rowValue,
                        styles.rowValueEnd,
                        winner === "b" && styles.rowValueBigger,
                      ]}
                    >
                      {row.b?.value ?? "—"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Section>
        ))}
      </ScrollView>
    </Layout>
  );
};

export default SpeciesCompareScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    layout: { paddingHorizontal: 12 },
    content: { paddingTop: 8, paddingBottom: 32 },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    versus: {
      fontSize: 13,
      fontWeight: "700",
      color: Colors.textSecondary,
    },
    pickerCard: {
      flex: 1,
      alignItems: "center",
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      padding: 12,
      gap: 4,
    },
    pickerThumb: {
      width: 72,
      height: 72,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },
    pickerThumbEmpty: {
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.primary200,
    },
    pickerName: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
      textAlign: "center",
    },
    pickerLatin: {
      fontSize: 11,
      fontStyle: "italic",
      color: Colors.textSecondary,
      textAlign: "center",
    },
    pickerStatus: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: Colors.primary200,
    },
    pickerStatusText: {
      fontSize: 10,
      fontWeight: "700",
      color: Colors.textMain,
    },
    row: {
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.divider,
    },
    rowLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginBottom: 2,
    },
    rowValues: { flexDirection: "row" },
    rowValue: {
      flex: 1,
      fontSize: 14,
      color: Colors.textMain,
    },
    rowValueEnd: { textAlign: "right" },
    rowValueBigger: { fontWeight: "700", color: Colors.main100 },
  });
