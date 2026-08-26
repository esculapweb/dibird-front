import { ReactNode, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import ItemsList from "../ui/ItemsList";
import SearchInput from "../ui/SearchInput";
import ErrorOverlay from "../Error/ErrorOverlay";
import LoadingOverlay from "../ui/LoadingOverlay";
import TaxonRow from "./TaxonRow";
import TaxonFilterChips from "./TaxonFilterChips";
import { useTheme } from "../../store/theme-context";
import { useList } from "../../hooks/useList";
import { useDebounce } from "../../hooks/useDebounce";
import { StaleTime } from "../../constants/staleTime";
import { fetchTaxonList } from "../../util/fetches";
import { stableStringify } from "../../util/helpers";
import { latinPart, territoryStatusNote } from "../../util/taxonomy";
import { useOpenSpecies } from "../../hooks/useOpenSpecies";
import {
  AppStackNavigationProp,
  SpeciesEntryPoint,
  TaxonListItem,
  TaxonRank,
  TaxonTraitFilters,
} from "../../types";

interface TaxonChildrenListProps {
  rank: TaxonRank;
  parent?: { segment: string; rank: TaxonRank } | null;
  extinct?: boolean;
  errorTitle: string;
  emptyMessage: string;
  listHeader?: ReactNode;
  sort?: string | null;
  traits?: TaxonTraitFilters | null;
  // Filters the page itself imposes (a country's own species list) — they go
  // into the query like `traits`, but carry no chip and can't be cleared:
  // dropping one would turn the page into a different page.
  fixedTraits?: TaxonTraitFilters | null;
  onClearTraits?: () => void;
  // Per-filter removal from the chips row; without it the chips don't render.
  onChangeTraits?: (next: TaxonTraitFilters) => void;
  // Picker mode: hand the tapped species to this callback instead of opening
  // its page (see AppStackParamList.Taxonomy.pickerKey).
  onPick?: (item: TaxonListItem) => void;
  searchPlaceholder?: string;
  autoFocusSearch?: boolean;
  // Name search. Uncontrolled by default (own state, seeded from
  // `initialSearch` for shared deep links); when the parent also needs the
  // current query — e.g. to build a share URL — it passes `search` +
  // `onChangeSearch` and owns the state instead.
  initialSearch?: string;
  search?: string;
  onChangeSearch?: (next: string) => void;
  // Which page this list is standing on, for `species_viewed`. The same list
  // serves the catalogue root, a taxon group and a country's species tab, and
  // only the host knows which.
  speciesSource: SpeciesEntryPoint;
}

const TaxonChildrenList = ({
  rank,
  parent,
  extinct,
  errorTitle,
  emptyMessage,
  listHeader,
  sort = "name",
  traits,
  fixedTraits,
  onClearTraits,
  onChangeTraits,
  onPick,
  searchPlaceholder,
  autoFocusSearch,
  initialSearch,
  search: controlledSearch,
  onChangeSearch,
  speciesSource,
}: TaxonChildrenListProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const navigation = useNavigation<AppStackNavigationProp>();
  const openSpecies = useOpenSpecies();
  const [internalSearch, setInternalSearch] = useState(initialSearch ?? "");
  const search = controlledSearch ?? internalSearch;
  const setSearch = onChangeSearch ?? setInternalSearch;
  const debouncedSearch = useDebounce(search);

  // The trait filters travel inside fetchTaxonList's closure, which useList
  // can't see — they have to be part of the query key here, or react-query
  // keeps serving the unfiltered pages it already has.
  const query = { ...fixedTraits, ...traits };
  const screenName = `Taxonomy-${rank}-${parent?.segment ?? "root"}-${!!extinct}-${stableStringify(query)}`;
  const styles = stylesFn(Colors);
  const hasTraitFilters = Object.values(traits ?? {}).some((value) =>
    Array.isArray(value) ? value.length > 0 : value != null,
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    isRefetching,
    error,
    refetch,
  } = useList<TaxonListItem>({
    screenName,
    fetchFunction: fetchTaxonList(rank, parent, extinct, query),
    filters: {},
    sort,
    search: debouncedSearch,
    enabled: true,
    staleTime: StaleTime.ONE_DAY,
  });

  const items = data?.pages.flatMap((page) => page.results) ?? [];
  const total = data?.pages[0]?.pagination?.count;

  const handlePress = (item: TaxonListItem) => {
    if (onPick) {
      onPick(item);
      return;
    }
    if (rank === 5) {
      openSpecies(item.segment, speciesSource);
    } else {
      navigation.navigate("TaxonGroupDetail", {
        segment: item.segment,
        rank: rank as 2 | 3 | 4,
      });
    }
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  if (isError && !data)
    return (
      <ErrorOverlay
        title={errorTitle}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );

  if (isLoading || !data) return <LoadingOverlay />;

  return (
    <ItemsList
      data={items}
      onEndReached={handleLoadMore}
      isLoadingMore={isFetchingNextPage}
      renderItem={({ item }) => {
        // Only the occurrence half of the country status earns a line — the
        // rest just spells out the IUCN category the badge already shows
        // (same rule as the checklist tree).
        const occurrence = territoryStatusNote(item.occurrence, item.status);

        return (
          <TaxonRow
            title={item.name_lang}
            latin={latinPart(item.name, item.name_lang)}
            thumb={item.thumb}
            statusCode={item.status}
            occurrence={
              occurrence &&
              (occurrence.key ? t(occurrence.key) : occurrence.raw)
            }
            onPress={() => handlePress(item)}
          />
        );
      }}
      keyExtractor={(item) => item.segment}
      emptyType={debouncedSearch || hasTraitFilters ? "filtered" : "initial"}
      onClear={() => {
        setSearch("");
        onClearTraits?.();
      }}
      noItems={{ icon: "leaf-outline", message: emptyMessage }}
      onRefresh={refetch}
      isRefreshing={isRefetching}
      listHeader={
        <>
          {listHeader}
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder={searchPlaceholder ?? t("search")}
            autoFocus={autoFocusSearch}
          />
          {hasTraitFilters && onChangeTraits && traits && (
            <TaxonFilterChips traits={traits} onChange={onChangeTraits} />
          )}
          {hasTraitFilters && total != null && (
            <Text style={styles.total}>
              {t("found")}: {total}
            </Text>
          )}
        </>
      }
    />
  );
};

export default TaxonChildrenList;

const stylesFn = (Colors: { textSecondary: string }) =>
  StyleSheet.create({
    total: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 6,
      marginLeft: 4,
    },
  });
