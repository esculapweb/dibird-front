import { useState, useCallback } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchStat } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import Tabs from "../components/ui/Tabs";
import { useFilters } from "../store/filters-context";

const StatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { territory } = useFilters();
  const [seenMode, setSeenMode] = useState("seen");
  const [currentFilters, setCurrentFilters] = useState({});

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

  return (
    <View style={{ flex: 1 }}>
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
      <Tabs tabsMode={seenMode} setTabsMode={setSeenMode} />
    </View>
  );
};

export default StatScreen;
