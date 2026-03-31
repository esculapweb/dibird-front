import { useState, useCallback } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchStat } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import Tabs from "../components/ui/Tabs";
import { useFilters } from "../store/filters-context";

const UserStatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { profileId } = route.params;
  const { seenMode, setSeenMode } = useFilters();

  const [noItems, setNoItems] = useState({
    icon: "stats-chart",
    message: t("no_stat_yet"),
    actions: [],
  });

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
        onPress={() => {}}
      />
    ),
    [seenMode],
  );

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        route={route}
        navigation={navigation}
        fetchFunction={fetchData}
        title={t("statistics")}
        errorTitle={t("stat_unavailable")}
        renderItem={renderItem}
        noItems={noItems}
        tabsMode={seenMode}
        getItemId={(item) => item.species_id}
        allowSort={true}
        extraFilters={{ user_id: profileId }}
        allowedFilters={["territory", "species", "date"]}
      />
      <Tabs tabsMode={seenMode} setTabsMode={setSeenMode} />
    </View>
  );
};

export default UserStatScreen;
