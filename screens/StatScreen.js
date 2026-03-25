import { useState, useCallback } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchStat, fetchChecklist } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import ChecklistCard from "../components/Stats/ChecklistCard";
import Tabs from "../components/ui/Tabs";
import { useFilters } from "../store/filters-context";
import SegmentedControl from "../components/ui/SegmentedControl";

const StatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { territory, seenMode, setSeenMode } = useFilters();
  const [currentFilters, setCurrentFilters] = useState({});

  const viewMode = route.name === "Checklist" ? "checklist" : "stats";

  const handleModeChange = useCallback(
    (mode) => {
      const targetRoute = mode === "checklist" ? "Checklist" : "Stat";

      if (route.name !== targetRoute) {
        navigation.replace(targetRoute);
      }
    },
    [navigation, route.name],
  );

  const SEGMENT_OPTIONS = [
    { value: "stats", label: t("statistics") },
    { value: "checklist", label: t("checklist") },
  ];

  const handleAdd = useCallback(() => {
    const defaultTerritory = currentFilters?.territory ?? territory ?? null;
    const defaultPlace = currentFilters?.place ?? null;
    navigation.navigate("ObservationEditor", {
      defaultTerritory,
      defaultPlace,
      returnMode: "back",
    });
  }, [navigation, currentFilters, territory]);

  const [noItems, setNoItems] = useState({
    icon: "stats-chart",
    message: t("no_stat_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  });

  const handleStatCardPress = useCallback(
    (item) => {
      if (!item.seen) {
        navigation.navigate("ObservationEditor", {
          defaultTerritory: currentFilters.territory ?? null,
          defaultPlace: currentFilters.place ?? null,
          defaultSpecies: item.species_id,
          returnMode: "back",
        });
        return;
      }

      navigation.navigate("Observations", {
        filtersOverride: {
          territory: currentFilters.territory ?? null,
          place: currentFilters.place ?? null,
          species: item.species_id,
          speciesName: item.sp_name_lang,
          date: currentFilters.date ?? null,
        },
      });
    },
    [currentFilters, navigation],
  );

  const fetchData = useCallback(
    (filters, sort, search, page, openFilterModal) => {
      const safeFilters = { ...filters };

      if (!safeFilters.territory && seenMode !== "seen") {
        setNoItems({
          icon: "stats-chart",
          message: t("select_territory_to_view_not_seen"),
          actions: [{ label: t("select_territory"), onPress: openFilterModal }],
        });
        return Promise.resolve({ results: [], pagination: { count: 0 } });
      }

      safeFilters.seen =
        seenMode === "seen" ? true : seenMode === "unseen" ? false : null;

      return fetchStat(safeFilters, sort, search, page);
    },
    [seenMode, t],
  );

  const fetchDataChecklist = useCallback(
    (filters, sort, search, page, openFilterModal) => {
      const safeFilters = { ...filters };

      if (!safeFilters.territory && seenMode !== "seen") {
        setNoItems({
          icon: "stats-chart",
          message: t("select_territory_to_view_not_seen"),
          actions: [{ label: t("select_territory"), onPress: openFilterModal }],
        });
        return Promise.resolve({ results: [], pagination: { count: 0 } });
      }

      safeFilters.seen =
        seenMode === "seen" ? true : seenMode === "unseen" ? false : null;

      return fetchChecklist(safeFilters, sort, search, page);
    },
    [seenMode, t],
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <StatCard
        item={item}
        index={index}
        seenMode={seenMode}
        onPress={() => handleStatCardPress(item)}
      />
    ),
    [seenMode, handleStatCardPress],
  );

  const renderItemChecklist = useCallback(
    ({ item, index }) => (
      <ChecklistCard
        item={item}
        index={index}
        seenMode={seenMode}
        onPress={() => handleStatCardPress(item)}
      />
    ),
    [seenMode, handleStatCardPress],
  );

  return (
    <View style={{ flex: 1 }}>
      <SegmentedControl
        options={SEGMENT_OPTIONS}
        value={viewMode}
        onChange={handleModeChange}
      />
      {viewMode === "stats" ? (
        <ListScreen
          route={route}
          navigation={navigation}
          fetchFunction={fetchData}
          errorTitle={t("stat_unavailable")}
          renderItem={renderItem}
          noItems={noItems}
          title={t("statistics")}
          tabsMode={seenMode}
          getItemId={(item) => item.species_id}
          onFiltersChange={setCurrentFilters}
        />
      ) : (
        <ListScreen
          route={route}
          navigation={navigation}
          fetchFunction={fetchDataChecklist}
          errorTitle={t("checklist_unavailable")}
          renderItem={renderItemChecklist}
          noItems={noItems}
          title={t("checklist")}
          tabsMode={seenMode}
          getItemId={(item) => item.species_id ?? item.id}
          onFiltersChange={setCurrentFilters}
          screenNameOverride="Checklist"
          allowSort={false}
        />
      )}
      <Tabs tabsMode={seenMode} setTabsMode={setSeenMode} />
    </View>
  );
};

export default StatScreen;
