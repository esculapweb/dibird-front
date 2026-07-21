import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import ItemsList from "../ui/ItemsList";
import SearchInput from "../ui/SearchInput";
import ErrorOverlay from "../Error/ErrorOverlay";
import LoadingOverlay from "../ui/LoadingOverlay";
import TaxonRow from "./TaxonRow";
import { useList } from "../../hooks/useList";
import { useDebounce } from "../../hooks/useDebounce";
import { StaleTime } from "../../constants/staleTime";
import { fetchTaxonList } from "../../util/fetches";
import { AppStackNavigationProp, TaxonListItem, TaxonRank } from "../../types";

interface TaxonChildrenListProps {
  rank: TaxonRank;
  parent?: { segment: string; rank: TaxonRank } | null;
  extinct?: boolean;
  errorTitle: string;
  emptyMessage: string;
  listHeader?: ReactNode;
}

const TaxonChildrenList = ({
  rank,
  parent,
  extinct,
  errorTitle,
  emptyMessage,
  listHeader,
}: TaxonChildrenListProps) => {
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  const screenName = `Taxonomy-${rank}-${parent?.segment ?? "root"}-${!!extinct}`;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useList<TaxonListItem>({
    screenName,
    fetchFunction: fetchTaxonList(rank, parent, extinct),
    filters: {},
    sort: "name",
    search: debouncedSearch,
    enabled: true,
    staleTime: StaleTime.ONE_DAY,
  });

  const items = data?.pages.flatMap((page) => page.results) ?? [];

  const handlePress = (item: TaxonListItem) => {
    if (rank === 5) {
      navigation.navigate("SpeciesDetail", { segment: item.segment });
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
      renderItem={({ item }) => (
        <TaxonRow item={item} rank={rank} onPress={() => handlePress(item)} />
      )}
      keyExtractor={(item) => item.segment}
      emptyType={debouncedSearch ? "filtered" : "initial"}
      onClear={() => setSearch("")}
      noItems={{ icon: "leaf-outline", message: emptyMessage }}
      listHeader={
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
    />
  );
};

export default TaxonChildrenList;
