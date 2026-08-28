import { ReactNode, useMemo, useState } from "react";
import {
  SectionList,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { useOpenSpecies } from "../../hooks/useOpenSpecies";

import SearchInput from "../ui/SearchInput";
import EmptyState from "../Empty/EmptyState";
import TaxonRow from "./TaxonRow";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { latinPart } from "../../util/taxonomy";
import { AppStackNavigationProp, TaxonDescendant } from "../../types";

interface GenusSection {
  genus: TaxonDescendant | null;
  data: TaxonDescendant[];
}

interface TaxonDescendantsListProps {
  // The flat depth-ordered tree a family/genus detail carries: each genus
  // (depth 4) is followed by its own species (depth 5).
  descendants: TaxonDescendant[];
  // A genus page is a single group, so repeating its name above the species
  // would just be noise — only families need the per-genus headers.
  showGroupHeaders?: boolean;
  // Same values as the list endpoint's `o` (name/-name/ioc_id/-ioc_id), but
  // applied locally: the whole subtree is already here, and it arrives in
  // taxonomic order, so "ioc_id" is simply the order it came in.
  sort?: string | null;
  emptyMessage: string;
  listHeader?: ReactNode;
  // The subtree comes from the parent screen's query, so refreshing it is
  // that screen's job — this just wires up the gesture.
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const sortSections = (
  sections: GenusSection[],
  sort: string | null,
): GenusSection[] => {
  if (!sort || sort === "ioc_id") return sections;
  if (sort === "-ioc_id")
    return sections
      .slice()
      .reverse()
      .map((s) => ({ ...s, data: s.data.slice().reverse() }));

  const direction = sort.startsWith("-") ? -1 : 1;
  const byName = (a: string, b: string) => direction * a.localeCompare(b);

  return sections
    .map((section) => ({
      ...section,
      data: section.data
        .slice()
        .sort((a, b) => byName(a.d_name_lang, b.d_name_lang)),
    }))
    .sort((a, b) => byName(a.genus?.d_name ?? "", b.genus?.d_name ?? ""));
};

const groupByGenus = (descendants: TaxonDescendant[]): GenusSection[] => {
  const sections: GenusSection[] = [];

  for (const d of descendants) {
    if (d.depth < 5) {
      sections.push({ genus: d, data: [] });
      continue;
    }
    // Species arriving before any genus (shouldn't happen, but the tree is
    // built from raw depths) still need somewhere to go.
    if (sections.length === 0) sections.push({ genus: null, data: [] });
    sections[sections.length - 1].data.push(d);
  }

  return sections;
};

const TaxonDescendantsList = ({
  descendants,
  showGroupHeaders = false,
  sort = null,
  emptyMessage,
  listHeader,
  onRefresh,
  isRefreshing,
}: TaxonDescendantsListProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();
  const openSpecies = useOpenSpecies();
  const [search, setSearch] = useState("");

  // Everything is already in memory (one detail request brings the whole
  // subtree), so filtering is local and instant — no debounce needed.
  const sections = useMemo(() => {
    const grouped = sortSections(groupByGenus(descendants), sort);
    const query = search.trim().toLowerCase();
    if (!query) return grouped.filter((s) => s.data.length > 0);

    return grouped
      .map((section) => {
        const genusMatches = section.genus?.d_name
          .toLowerCase()
          .includes(query);
        if (genusMatches) return section;
        return {
          ...section,
          data: section.data.filter(
            (d) =>
              d.d_name.toLowerCase().includes(query) ||
              d.d_name_lang.toLowerCase().includes(query),
          ),
        };
      })
      .filter((section) => section.data.length > 0);
  }, [descendants, search, sort]);

  return (
    <SectionList
      testID="items-list"
      sections={sections}
      keyExtractor={(item) => item.d_segment}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[
        styles.list,
        sections.length === 0 && { flexGrow: 1 },
      ]}
      ListHeaderComponent={
        <>
          {listHeader}
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder={t("search")}
          />
        </>
      }
      renderSectionHeader={({ section }) => {
        if (!showGroupHeaders || !section.genus) return null;
        const genus = section.genus;
        return (
          <Pressable
            style={({ pressed }) => [
              styles.genusHeader,
              pressed && styles.genusHeaderPressed,
            ]}
            onPress={() =>
              navigation.navigate("TaxonGroupDetail", {
                segment: genus.d_segment,
                rank: 4,
              })
            }
          >
            <Text style={styles.genusName} numberOfLines={1}>
              {genus.d_name}
            </Text>
            <Text style={styles.genusCount}>{section.data.length}</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Colors.textSecondary}
            />
          </Pressable>
        );
      }}
      renderItem={({ item }) => (
        <TaxonRow
          title={item.d_name_lang}
          latin={latinPart(item.d_name, item.d_name_lang)}
          thumb={item.thumb}
          statusCode={item.d_status}
          onPress={() => openSpecies(item.d_segment, "taxon_group")}
        />
      )}
      ListEmptyComponent={
        search ? (
          <EmptyState
            icon="search-outline"
            message={t("nothing_found")}
            actions={[{ label: t("reset_filters"), onPress: () => setSearch("") }]}
          />
        ) : (
          <EmptyState icon="leaf-outline" message={emptyMessage} />
        )
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.textMain}
            colors={[Colors.textMain]}
          />
        ) : undefined
      }
      initialNumToRender={12}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews
    />
  );
};

export default TaxonDescendantsList;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    list: { paddingHorizontal: 12, paddingVertical: 8 },
    genusHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 4,
      paddingTop: 14,
      paddingBottom: 6,
    },
    genusHeaderPressed: { opacity: 0.6 },
    genusName: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      fontStyle: "italic",
      color: Colors.textMain,
    },
    genusCount: {
      fontSize: 12,
      fontWeight: "600",
      color: Colors.textSecondary,
    },
  });
