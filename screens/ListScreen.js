import {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

import LoadingOverlay from "../components/ui/LoadingOverlay";
import FilterModal from "../components/Filters/FilterModal";
import SortModal from "../components/Sort/SortModal";
import { loadSort } from "../util/storageHelper";
import IconsHeader from "../components/ui/IconsHeader";
import FilterChips from "../components/Filters/FilterChips";

import { normalizeValue } from "../util/helpers";
import { useList } from "../hooks/useList";
import ItemsList from "../components/ui/ItemsList";
import HeaderTitleWithBadge from "../components/ui/HeaderTitleWithBadge";
import SearchInput from "../components/ui/SearchInput";
import { useDebounce } from "../util/useDebounce";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { sortOptionsList } from "../util/sortOptionsList";
import { parseDeepLinkParams } from "../util/parseDeepLinkParams";
import { useFilters } from "../store/filters-context";
import { useTheme } from "../store/theme-context";

const ListScreen = ({
  route,
  navigation,
  fetchFunction,
  allowedFilters = ["territory", "place", "date", "species"],
  errorTitle,
  onAdd,
  renderItem,
  noItems,
  showSearch,
  title,
  tabsMode,
  listHeader,
  extraFilters,
  headerRightBeginning,
  headerRightEnd,
  handleSharePress,
  fabOffset,
  fabIcon,
  getItemId = (item) => item.id,
  onFiltersChange,
  onSortChange,
  locationCoords,
  locationAvailable = true,
  permissionStatus,
  onLocationUnavailable,
  screenNameOverride,
  allowSort = true,
  onOpenFilterModal,
  showHeaderBadge = true,
}) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const {
    territory,
    setTerritory,
    date,
    setDate,
    place,
    setPlace,
    species,
    setSpecies,
  } = useFilters();

  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(null);
  const [sortReady, setSortReady] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const screenName = screenNameOverride ?? route.name;
  const sortOptions = sortOptionsList(screenName);
  const [filterHints, setFilterHints] = useState({});
  const [ignoreContextSync, setIgnoreContextSync] = useState(false);
  const initFiltersRef = useRef(false);
  const overrideAppliedRef = useRef(false);

  const keyExtractor = (item, _) => `${screenName}-${getItemId(item)}`;

  useEffect(() => {
    onOpenFilterModal?.(() => setFilterModalVisible(true));
  }, []);

  const fetchDataWrapper = useCallback(
    (filters, sort, search, page) => {
      return fetchFunction(
        filters,
        sort,
        search,
        page,
        () => setFilterModalVisible(true),
        locationCoords,
      );
    },
    [fetchFunction, locationCoords],
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useList({
    screenName,
    fetchFunction: fetchDataWrapper,
    filters,
    sort,
    search: debouncedSearch,
    tabsMode,
    extraFilters,
    locationCoords,
    enabled: sortReady && filtersLoaded,
  });

  const rawItems = data?.pages.flatMap((page) => page.results) ?? [];
  const objects = new Set();
  const items = rawItems.filter((item) => {
    const id = getItemId(item);
    if (objects.has(id)) return false;
    objects.add(id);
    return true;
  });

  const hasActiveFilters = filters
    ? allowedFilters.some((key) => {
        const v = filters[key];
        return Array.isArray(v) ? v.length > 0 : v != null && v !== "";
      })
    : false;
  const hasActiveFiltersRef = useRef(hasActiveFilters);
  useEffect(() => {
    hasActiveFiltersRef.current = hasActiveFilters;
  }, [hasActiveFilters]);

  const isEmpty = items.length === 0;
  const isSearchActive = debouncedSearch.length > 0;
  const isDistanceSort = (val) => val === "distance" || val === "-distance";

  const emptyType =
    !isLoading && isEmpty
      ? isSearchActive || hasActiveFilters
        ? "filtered"
        : "initial"
      : null;

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleFiltersApplied = (newFilters) => {
    setIgnoreContextSync(false);
    setFilters(newFilters);
  };

  const handleClearFilters = async () => {
    setIgnoreContextSync(true);
    await setDate(null);
    await setTerritory(null);
    await setPlace(null);
    await setSpecies(null);
    setFilters({});
    setFilterModalVisible(false);
  };

  const handleClearSearch = () => setSearch("");

  const handleClearFiltersSearch = () => {
    handleClearSearch();
    handleClearFilters();
  };

  const removeFilter = (key) => {
    setIgnoreContextSync(true);
    if (key === "date") setDate(null);
    if (key === "territory") {
      setTerritory(null);
      setPlace(null);
      setSpecies(null);
    }
    if (key === "place") setPlace(null);
    if (key === "species") setSpecies(null);

    if (!route.params?.filtersOverride && !overrideAppliedRef.current) {
      setFilters((prev) => {
        const newFilters = { ...prev };
        newFilters[key] = undefined;
        if (key === "territory") {
          newFilters.place = undefined;
          newFilters.species = undefined;
        }
        return newFilters;
      });
    }
  };

  const headerRight = () => (
    <IconsHeader
      hasActiveFilters={hasActiveFiltersRef.current}
      onSortPress={allowSort ? () => setSortModalVisible(true) : null}
      onFilterPress={() => setFilterModalVisible(true)}
      onSharePress={handleSharePress}
      headerRightBeginning={headerRightBeginning}
      headerRightEnd={headerRightEnd}
    />
  );

  const headerRightKey = `${!!handleSharePress}-${!!allowSort}-${headerRightBeginning?.length}-${headerRightEnd?.length}`;

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters]);

  useEffect(() => {
    onSortChange?.(sort);
  }, [sort]);

  useEffect(() => {
    const initFilters = async () => {
      if (route.params?.filtersOverride && !initFiltersRef.current) {
        const { speciesName, ...overrideFilters } =
          route.params.filtersOverride;
        setFilters(overrideFilters);
        setFilterHints({ speciesName });
        setIgnoreContextSync(true);

        initFiltersRef.current = true;

        navigation.setParams({ filtersOverride: undefined });
        setSortReady(true);
        setTimeout(() => {
          setFiltersLoaded(true);
        }, 0);
        return;
      }

      const {
        filters: deepFilters,
        sort: deepSort,
        hasParams,
      } = parseDeepLinkParams(route.params);

      if (hasParams) {
        overrideAppliedRef.current = true;
        setFilters({ ...deepFilters });
        setIgnoreContextSync(true);
        if (deepSort) setSort(deepSort);
        setSortReady(true);
      } else {
        setFilters({
          territory: territory ?? null,
          place: place ?? null,
          date: date ?? null,
          species: species ?? null,
        });

        if (allowSort) {
          const storedSort = await loadSort(screenName);
          const resolved = normalizeValue(
            storedSort,
            sortOptions.map((i) => i.value),
          );
          setSort(
            isDistanceSort(resolved) && permissionStatus === "denied"
              ? (sortOptions.find((o) => !isDistanceSort(o.value))?.value ??
                  resolved)
              : resolved,
          );
          setSortReady(true);
        } else {
          setSortReady(true);
        }
      }

      setFiltersLoaded(true);
    };
    initFilters();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.filtersOverride) return;
      if (!filtersLoaded) return;

      setFilters((prev) => {
        if (!prev) return prev;

        let newFilters = { ...prev };
        let changed = false;

        if (!ignoreContextSync) {
          const prevDate = JSON.stringify(prev.date ?? null);
          const contextDate = JSON.stringify(date ?? null);
          if (prevDate !== contextDate) {
            newFilters.date = date ?? null;
            changed = true;
          }

          const prevTerritory = prev.territory ?? null;
          const contextTerritory = territory ?? null;
          if (prevTerritory !== contextTerritory) {
            newFilters.territory = contextTerritory;
            newFilters.place = null;
            newFilters.species = null;
            changed = true;
          } else {
            const prevPlace = prev.place ?? null;
            const contextPlace = place ?? null;
            if (prevPlace !== contextPlace) {
              newFilters.place = contextPlace;
              changed = true;
            }
            const prevSpecies = prev.species ?? null;
            const contextSpecies = species ?? null;
            if (prevSpecies !== contextSpecies) {
              newFilters.species = contextSpecies;
              changed = true;
            }
          }
        }

        return changed ? newFilters : prev;
      });
    }, [
      date,
      territory,
      place,
      species,
      filtersLoaded,
      ignoreContextSync,
    ]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HeaderTitleWithBadge
          title={title}
          badgeCount={
            showHeaderBadge
              ? (data?.pages[0]?.pagination?.count ?? 0)
              : undefined
          }
        />
      ),
      headerRight,
    });
  }, [navigation, headerRightKey, data]);

  if (isError)
    return (
      <ErrorOverlay
        title={errorTitle}
        message={error.message}
        onPress={refetch}
        logo
      />
    );
  if (isLoading || !data) return <LoadingOverlay />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight - insets.bottom + 8}
    >
      {hasActiveFilters && (
        <FilterChips
          filters={filters}
          onRemove={removeFilter}
          extraFilters={extraFilters}
          hints={filterHints}
          allowed={allowedFilters}
        />
      )}
      <ItemsList
        data={items}
        onEndReached={handleLoadMore}
        isLoadingMore={isFetchingNextPage}
        onAdd={onAdd}
        emptyType={emptyType}
        onClear={handleClearFiltersSearch}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        noItems={noItems}
        listHeader={listHeader}
        fabOffset={fabOffset}
        fabIcon={fabIcon}
      />
      <SortModal
        screen={screenName}
        options={sortOptions}
        visible={sortModalVisible}
        onClose={() => setSortModalVisible(false)}
        sort={sort}
        setSort={setSort}
        locationAvailable={locationAvailable}
        onLocationUnavailable={onLocationUnavailable}
      />
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        allowed={allowedFilters}
        setFilters={handleFiltersApplied}
        clearFilters={handleClearFilters}
        extraTerritory={extraFilters?.territory}
      />
      {showSearch && (
        <View
          edges={["bottom"]}
          style={{
            backgroundColor: Colors.backgroundMain,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: Colors.border,
            paddingBottom: insets.bottom,
          }}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={handleClearSearch}
            placeholder={t("search_by_name")}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

export default ListScreen;
