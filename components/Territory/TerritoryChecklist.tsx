import { ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";

import ItemsList from "../ui/ItemsList";
import SearchInput from "../ui/SearchInput";
import ErrorOverlay from "../Error/ErrorOverlay";
import LoadingOverlay from "../ui/LoadingOverlay";
import ChecklistCard from "../Stats/ChecklistCard";
import { fetchTerritoryTree } from "../../util/fetches";
import { StaleTime } from "../../constants/staleTime";
import { useLanguage } from "../../store/language-context";
import { CatalogNavigationProp, ChecklistItem } from "../../types";

// How deeply each kind of group header nests, so the search filter knows
// which pending headers a new one replaces.
const GROUP_LEVEL: Record<string, number> = { order: 0, family: 1, genus: 2 };

interface TerritoryChecklistProps {
  // Avibase's own territory id — what the public /api/checklist/ is keyed by.
  idAvibase: number;
  listHeader?: ReactNode;
}

// A country's birds in taxonomic order — order, family, species — laid out
// like the app's own checklist screen but with its personal half switched off
// (see ChecklistCard's `personal`): this is the catalogue, and a checkbox here
// answers "seen" without saying when. Hence the public endpoint rather than
// /myapi/checklist2/ — see fetchTerritoryTree. The whole country arrives in a
// single page, so the search filters in memory.
const TerritoryChecklist = ({
  idAvibase,
  listHeader,
}: TerritoryChecklistProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const navigation = useNavigation<CatalogNavigationProp>();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, isRefetching, error, refetch } = useQuery<
    ChecklistItem[]
  >({
    queryKey: ["TerritoryChecklist", idAvibase, language],
    queryFn: () => fetchTerritoryTree(idAvibase),
    staleTime: StaleTime.ONE_DAY,
  });

  // Filtering has to keep a group header only while something under it
  // survives. Headers are held back as a pending chain (order, then family)
  // and flushed the moment a species below them matches — so a family whose
  // birds all fell out disappears, but the order above it stays if another
  // family under it still has some.
  const items = useMemo(() => {
    const rows = data ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    const kept: ChecklistItem[] = [];
    let pending: ChecklistItem[] = [];

    for (const row of rows) {
      if (row.type !== "species") {
        // A header replaces any pending header of its own level or deeper,
        // and keeps the shallower ones it still sits under.
        const level = GROUP_LEVEL[row.type] ?? 0;
        pending = pending.filter(
          (p) => (GROUP_LEVEL[p.type] ?? 0) < level,
        );
        pending.push(row);
        continue;
      }
      if (
        row.name_lang.toLowerCase().includes(query) ||
        row.latin.toLowerCase().includes(query)
      ) {
        kept.push(...pending, row);
        pending = [];
      }
    }
    return kept;
  }, [data, search]);

  if (isError && !data)
    return (
      <ErrorOverlay
        title={t("checklist_unavailable")}
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
      renderItem={({ item, index }: { item: ChecklistItem; index: number }) => (
        // personal={false}: this is the catalogue, not the user's checklist —
        // a "seen" mark here would raise "seen when?", which the country page
        // has no answer to.
        <ChecklistCard
          item={item}
          index={index}
          personal={false}
          onToggle={() => {}}
          onPress={() =>
            navigation.navigate("SpeciesDetail", { segment: item.segment })
          }
        />
      )}
      keyExtractor={(item: ChecklistItem, index: number) =>
        `${item.type}-${item.species_id ?? item.id}-${index}`
      }
      emptyType={search ? "filtered" : "initial"}
      onClear={() => setSearch("")}
      noItems={{ icon: "leaf-outline", message: t("no_species_found") }}
      onRefresh={refetch}
      isRefreshing={isRefetching}
      listHeader={
        <>
          {listHeader}
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder={t("search_species_hint")}
          />
        </>
      }
    />
  );
};

export default TerritoryChecklist;
