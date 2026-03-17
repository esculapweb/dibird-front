import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchStat } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import Tabs from "../components/ui/Tabs";

const StatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();

  const handleAdd = () => navigation.navigate("ObservationEditor");

  const [seenMode, setSeenMode] = useState(true);
  const [currentFilters, setCurrentFilters] = useState({});
  const [noItems, setNoItems] = useState({
    icon: "stats-chart",
    message: t("no_stat_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  });

  const handleStatCardPress = useCallback(
    (item) => {
      // +
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

  const fetchData = (filters, sort, search, page, openFilterModal) => {
    const safeFilters = { ...filters };

    if (!safeFilters.territory && seenMode === false) {
      setNoItems({
        icon: "stats-chart",
        message: t("select_territory_to_view_not_seen"),
        actions: [{ label: t("select_territory"), onPress: openFilterModal }],
      });

      return Promise.resolve({
        results: [],
        pagination: { count: 0 },
      });
    }
    safeFilters.seen = seenMode;

    return fetchStat(safeFilters, sort, search, page, seenMode);
  };

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
    <>
      <ListScreen
        route={route}
        navigation={navigation}
        fetchFunction={fetchData}
        allowedFilters={["territory", "place", "date", "species"]}
        errorTitle={t("stat_unavailable")}
        onAdd={handleAdd}
        renderItem={renderItem}
        noItems={noItems}
        title={t("statistics")}
        tabs={<Tabs tabsMode={seenMode} setTabsMode={setSeenMode} />}
        tabsMode={seenMode}
        getItemId={(item) => item.species_id}
        onFiltersChange={setCurrentFilters}
      />
    </>
  );
};

export default StatScreen;
