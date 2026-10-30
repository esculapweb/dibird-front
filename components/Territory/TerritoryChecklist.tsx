import { ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import ItemsList from "../ui/ItemsList";
import SearchInput from "../ui/SearchInput";
import ErrorOverlay from "../Error/ErrorOverlay";
import { ListSkeleton } from "../ui/Skeleton";
import ChecklistCard from "../Stats/ChecklistCard";
import { fetchTerritoryTree } from "../../util/fetches";
import { StaleTime } from "../../constants/staleTime";
import { useLanguage } from "../../store/language-context";
import { useOpenSpecies } from "../../hooks/useOpenSpecies";
import { ChecklistItem, TaxonTraitFilters } from "../../types";

// How deeply each kind of group header nests, so the search filter knows
// which pending headers a new one replaces.
const GROUP_LEVEL: Record<string, number> = { order: 0, family: 1, genus: 2 };

// The group filter a header stands for: its own segment and those of the
// headers above it (a family under its order, a genus under both).
export type ChecklistGroupFilter = Pick<
  TaxonTraitFilters,
  "order" | "family" | "genus"
>;

interface TerritoryChecklistProps {
  // Avibase's own territory id — what the public /api/checklist/ is keyed by.
  idAvibase: number;
  listHeader?: ReactNode;
  // A tap on an order/family/genus header: the host shows that group's birds
  // in this country (see TerritoryDetailScreen).
  onGroupPress: (group: ChecklistGroupFilter) => void;
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
  onGroupPress,
}: TerritoryChecklistProps) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const openSpecies = useOpenSpecies();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, isRefetching, error, refetch } = useQuery<
    ChecklistItem[]
  >({
    queryKey: ["TerritoryChecklist", idAvibase, language],
    queryFn: () => fetchTerritoryTree(idAvibase),
    staleTime: StaleTime.ONE_DAY,
  });

  // Each header's place in the tree, worked out once over the full rows (the
  // searched ones are the same objects, so the lookup holds for them too).
  const groupFilters = useMemo(() => {
    const filters = new Map<ChecklistItem, ChecklistGroupFilter>();
    let current: ChecklistGroupFilter = {};
    for (const row of data ?? []) {
      if (row.type === "order") current = { order: row.segment };
      else if (row.type === "family")
        current = { order: current.order, family: row.segment };
      else if (row.type === "genus")
        current = { ...current, genus: row.segment };
      else continue;
      filters.set(row, current);
    }
    return filters;
  }, [data]);

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

  if (isLoading || !data) return <ListSkeleton />;

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
          onPress={() => openSpecies(item.segment, "territory_checklist")}
          onSpeciesPress={() =>
            openSpecies(item.segment, "territory_checklist")
          }
          // The tree's headers are real taxa here (the country endpoint sends
          // their segments), so a header opens that group's birds — still in
          // this country, not the group's worldwide page.
          onGroupPress={(group) => {
            const filter = groupFilters.get(group);
            if (filter) onGroupPress(filter);
          }}
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
