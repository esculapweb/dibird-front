import { useState, useCallback, useRef } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchStat, fetchChecklist } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import ChecklistCard from "../components/Stats/ChecklistCard";
import Tabs from "../components/ui/Tabs";
import { useFilters } from "../store/filters-context";
import SegmentedControl from "../components/ui/SegmentedControl";
import ConfirmBottomSheet from "../components/ui/ConfirmBottomSheet";

const StatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const confirmRef = useRef(null);
  const { territory, seenMode, setSeenMode } = useFilters();
  const [currentFilters, setCurrentFilters] = useState({});

  const viewMode = route.name === "Checklist" ? "checklist" : "stats";

  const MODE_CONFIG = {
    stats: {
      fetch: fetchStat,
      component: StatCard,
      allowSort: true,
      getItemId: (item) => item.species_id,
      title: t("statistics"),
      errorTitle: t("stat_unavailable"),
      showUncheckWarning: false,
    },
    checklist: {
      fetch: fetchChecklist,
      component: ChecklistCard,
      allowSort: false,
      getItemId: (item) => item.species_id ?? item.id,
      title: t("checklist"),
      errorTitle: t("checklist_unavailable"),
      showUncheckWarning: true,
    },
  };
  const config = MODE_CONFIG[viewMode];

  const openUncheckSheet = (item) => {
    confirmRef.current?.present(item);
  };

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

  const handleShowObservations = (item) => {
    navigation.navigate("Observations", {
      filtersOverride: {
        territory: currentFilters.territory ?? null,
        place: currentFilters.place ?? null,
        species: item.species_id,
        speciesName: item.sp_name_lang,
        date: currentFilters.date ?? null,
      },
    });
  };

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
      if (config.showUncheckWarning) {
        openUncheckSheet(item);
        return;
      }
      handleShowObservations(item);
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

      const fetchFn = config.fetch;

      return fetchFn(safeFilters, sort, search, page);
    },
    [seenMode, t, viewMode],
  );

  const renderItem = useCallback(
    ({ item, index }) => {
      const Component = config.component;
      return (
        <Component
          item={item}
          index={index}
          seenMode={seenMode}
          onPress={() => handleStatCardPress(item)}
        />
      );
    },
    [seenMode, handleStatCardPress, viewMode],
  );

  return (
    <View style={{ flex: 1 }}>
      <SegmentedControl
        options={SEGMENT_OPTIONS}
        value={viewMode}
        onChange={handleModeChange}
      />

      <ListScreen
        route={route}
        navigation={navigation}
        fetchFunction={fetchData}
        title={config.title}
        errorTitle={config.errorTitle}
        renderItem={renderItem}
        noItems={noItems}
        tabsMode={seenMode}
        getItemId={config.getItemId}
        onFiltersChange={setCurrentFilters}
        allowSort={config.allowSort}
      />
      <Tabs tabsMode={seenMode} setTabsMode={setSeenMode} />
      <ConfirmBottomSheet
        ref={confirmRef}
        type="warning"
        title={t("uncheck_title")}
        description={t("uncheck_descriptions")}
        confirmText={t("view_observations")}
        cancelText={t("cancel")}
        onConfirm={handleShowObservations}
      />
    </View>
  );
};

export default StatScreen;
