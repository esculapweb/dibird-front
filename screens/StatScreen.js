import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchStat } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import Tabs from "../components/ui/Tabs";

const StatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const [seenMode, setSeenMode] = useState(true);

  const SORT_OPTIONS = [
    { label: t("taxonomic"), value: "ioc_id" },
    { label: t("taxonomic_desc"), value: "-ioc_id" },
    { label: t("alphabetic"), value: "name" },
    { label: t("alphabetic_desc"), value: "-name" },
    { label: t("date_sort_desc"), value: "-date_time" },
    { label: t("date_sort"), value: "date_time" },
  ];

  const handleAdd = () => navigation.navigate("ObservationEditor");

  const noItems = {
    icon: "stats-chart",
    message: t("no_stat_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  const renderItem = useCallback(
    ({ item, index }) => (
      <StatCard item={item} index={index} seenMode={seenMode} />
    ),
    [seenMode],
  );

  const keyExtractor = (item, _) => `${route.name}-${item.species_id}`;

  return (
    <>
      <ListScreen
        route={route}
        navigation={navigation}
        fetchFunction={(filters, sort, search, page) =>
          fetchStat(filters, sort, search, page, seenMode)
        }
        sortOptions={SORT_OPTIONS}
        allowedFilters={["territory", "place", "date"]}
        errorTitle={t("stat_unavailable")}
        onAdd={handleAdd}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        noItems={noItems}
        title={t("statistics")}
        tabs={<Tabs tabsMode={seenMode} setTabsMode={setSeenMode} />}
        tabsMode={seenMode}
      />
    </>
  );
};

export default StatScreen;
