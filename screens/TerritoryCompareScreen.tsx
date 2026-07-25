import { useLayoutEffect, useMemo, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import Layout from "../components/ui/Layout";
import Tabs from "../components/ui/Tabs";
import ItemsList from "../components/ui/ItemsList";
import SearchInput from "../components/ui/SearchInput";
import IconsHeader from "../components/ui/IconsHeader";
import EmptyState from "../components/Empty/EmptyState";
import TerritoryCompareRow from "../components/Territory/TerritoryCompareRow";
import { fetchTerritoryCompare, fetchTerritoryDetail } from "../util/fetches";
import { setNavigationCallback } from "../util/navigationCallbacks";
import { buildShareUrl, isoToFlagEmoji } from "../util/helpers";
import { StaleTime } from "../constants/staleTime";
import { useLanguage } from "../store/language-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  compareMode,
  TerritoryCompareSpecies,
  TerritoryListItem,
} from "../types";

type Side = 0 | 1;

// One side of the comparison: the segment the API is asked for, plus whatever
// the picker already knew about the country so the card can show it at once.
interface Slot {
  segment: string;
  name?: string | null;
  code?: string | null;
}

const TerritoryCompareScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { language } = useLanguage();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"TerritoryCompare">>();
  // Name and flag are kept next to the segment, not read back off the
  // comparison response: that response only exists once *both* countries are
  // picked, so a card driven by it alone would sit there saying "pick a
  // country" after the first pick — the choice would look like it didn't
  // register. A slot opened from a deep link has only the segment and fills
  // the rest in from the response when it arrives.
  const [slots, setSlots] = useState<[Slot | null, Slot | null]>([
    route.params?.segment1 ? { segment: route.params.segment1 } : null,
    route.params?.segment2 ? { segment: route.params.segment2 } : null,
  ]);
  const [tabMode, setTabMode] = useState<compareMode>("all");
  const [search, setSearch] = useState("");

  const segments: [string | null, string | null] = [
    slots[0]?.segment ?? null,
    slots[1]?.segment ?? null,
  ];
  const bothChosen = !!segments[0] && !!segments[1];

  // A slot opened from the country page (or a deep link) carries only the
  // segment, so without this the card would sit there showing a globe and a
  // raw latin slug. It's the same query that page uses — arriving from it the
  // name and flag come straight out of the cache, no request of their own.
  const detail0 = useQuery({
    queryKey: ["TerritoryDetail", segments[0], language],
    queryFn: () => fetchTerritoryDetail(segments[0] as string),
    enabled: !!segments[0] && !slots[0]?.name,
    staleTime: StaleTime.ONE_DAY,
  });

  const detail1 = useQuery({
    queryKey: ["TerritoryDetail", segments[1], language],
    queryFn: () => fetchTerritoryDetail(segments[1] as string),
    enabled: !!segments[1] && !slots[1]?.name,
    staleTime: StaleTime.ONE_DAY,
  });

  const details = [detail0.data, detail1.data];

  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: ["TerritoryCompare", segments[0], segments[1], language],
    queryFn: () =>
      fetchTerritoryCompare(segments[0] as string, segments[1] as string),
    enabled: bothChosen,
    staleTime: StaleTime.ONE_DAY,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t("compare_territories"),
      headerRight: () => (
        <IconsHeader
          onSharePress={
            bothChosen
              ? async () => {
                  const url = buildShareUrl(
                    `territory_compare/${segments[0]}/${segments[1]}/`,
                  );
                  await Share.share(
                    Platform.OS === "ios" ? { url } : { message: url },
                  );
                }
              : undefined
          }
        />
      ),
    });
  }, [navigation, t, bothChosen, segments]);

  const pickTerritory = (side: Side) => {
    const key = `territory-compare-${side}`;
    setNavigationCallback(key, (item) => {
      const picked = item as TerritoryListItem;
      setSlots((prev) => {
        const next: [Slot | null, Slot | null] = [...prev];
        next[side] = {
          segment: picked.segment,
          name: picked.name,
          code: picked.code,
        };
        return next;
      });
    });
    navigation.push("TerritoryList", {
      title: t("pick_country"),
      pickerKey: key,
    });
  };

  // The whole species list arrives in one response, so both the tab filter and
  // the search run locally.
  const species = useMemo(() => {
    const all = data?.species_data ?? [];
    const byTab = all.filter((s) => {
      const [inFirst, inSecond] = s.in_object ?? [false, false];
      if (tabMode === "common") return inFirst && inSecond;
      if (tabMode === "different") return inFirst !== inSecond;
      return true;
    });

    const query = search.trim().toLowerCase();
    if (!query) return byTab;
    return byTab.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.name_lang.toLowerCase().includes(query),
    );
  }, [data?.species_data, tabMode, search]);

  const territoryCard = (side: Side) => {
    const slot = slots[side];
    const fromServer = data?.territory_data?.[side];
    const fromDetail = details[side];
    const name = slot?.name ?? fromDetail?.name ?? fromServer?.name;
    const flag = isoToFlagEmoji(
      slot?.code ?? fromDetail?.code ?? fromServer?.code ?? null,
    );
    const dotColor = side === 0 ? Colors.compareP1 : Colors.compareP2;

    return (
      <Pressable
        style={styles.pickerCard}
        onPress={() => pickTerritory(side)}
        testID={`territory-pick-${side}`}
      >
        <View style={[styles.pickerDot, { backgroundColor: dotColor }]} />
        {flag ? (
          <Text style={styles.pickerFlag}>{flag}</Text>
        ) : (
          <Ionicons
            name={slot ? "globe-outline" : "add"}
            size={26}
            color={Colors.main100}
          />
        )}
        <Text style={styles.pickerName} numberOfLines={2}>
          {name ?? (slot ? slot.segment : t("pick_country"))}
        </Text>
        {data && (
          <Text style={styles.pickerCount}>
            {data.territory_all_count?.[side] ?? 0}
          </Text>
        )}
      </Pressable>
    );
  };

  const tabOptions = [
    {
      value: "common" as const,
      icon: "checkmark-circle" as const,
      iconInactive: "checkmark-circle-outline" as const,
      labelKey: t("common"),
      count: data?.common_count,
    },
    {
      value: "all" as const,
      icon: "list" as const,
      iconInactive: "list-outline" as const,
      labelKey: t("all"),
      count: data?.all_count,
    },
    {
      value: "different" as const,
      icon: "remove-circle" as const,
      iconInactive: "remove-circle-outline" as const,
      labelKey: t("different"),
      count: data?.different_count,
    },
  ];

  const header = (
    <>
      <View style={styles.pickerRow}>
        {territoryCard(0)}
        <Text style={styles.versus}>vs</Text>
        {territoryCard(1)}
      </View>
      {bothChosen && !!data && (
        <SearchInput
          value={search}
          onChange={setSearch}
          onClear={() => setSearch("")}
          placeholder={t("search_species_hint")}
        />
      )}
    </>
  );

  // Before both countries are picked (and while the comparison is loading or
  // has failed) the list is empty for a reason of its own, so it says so from
  // the header and ItemsList's own empty state stays out of the way.
  const preListState = !bothChosen ? (
    <EmptyState
      icon="git-compare-outline"
      message={t("compare_territories_hint")}
    />
  ) : isLoading ? (
    <EmptyState icon="hourglass-outline" message={t("loading")} />
  ) : isError ? (
    <EmptyState
      icon="alert-circle-outline"
      message={t("countries_unavailable")}
      actions={[{ label: t("try_again"), onPress: () => refetch() }]}
    />
  ) : null;

  return (
    <Layout
      bottom={
        bothChosen ? (
          <Tabs
            tabOptions={tabOptions}
            tabsMode={tabMode}
            setTabsMode={setTabMode}
          />
        ) : undefined
      }
    >
      <ItemsList
        data={species}
        renderItem={({ item }: { item: TerritoryCompareSpecies }) => (
          <TerritoryCompareRow
            item={item}
            onPress={() =>
              navigation.navigate("SpeciesDetail", { segment: item.segment })
            }
          />
        )}
        keyExtractor={(item: TerritoryCompareSpecies) => item.segment}
        emptyType={preListState ? undefined : search ? "filtered" : "initial"}
        onClear={() => setSearch("")}
        noItems={{ icon: "leaf-outline", message: t("no_species_found") }}
        onRefresh={bothChosen ? refetch : undefined}
        isRefreshing={isRefetching}
        listHeader={
          <>
            {header}
            {preListState}
          </>
        }
      />
    </Layout>
  );
};

export default TerritoryCompareScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
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
    // Ties the card to the dot colour used on every species row below.
    pickerDot: {
      width: 22,
      height: 4,
      borderRadius: 2,
      marginBottom: 4,
    },
    pickerFlag: { fontSize: 32 },
    pickerName: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
      textAlign: "center",
    },
    pickerCount: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
  });
