import { useState, useCallback, useRef, useMemo } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchStat, fetchChecklist } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import ChecklistCard from "../components/Stats/ChecklistCard";
import Tabs from "../components/ui/Tabs";
import { useFilters } from "../store/filters-context";
import ConfirmBottomSheet from "../components/ui/ConfirmBottomSheet";
import IconButton from "../components/ui/IconButton";
import { useTheme } from "../store/theme-context";

const StatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const confirmRef = useRef(null);
  const openFilterModalRef = useRef(null);
  const openUncheckSheet = (item) => {
    confirmRef.current?.present(item);
  };
  const { territory, seenMode, setSeenMode } = useFilters();
  const [currentFilters, setCurrentFilters] = useState({});

  const viewMode = route.name === "Checklist" ? "checklist" : "stats";

  const MODE_CONFIG = useMemo(
    () => ({
      stats: {
        fetch: fetchStat,
        component: StatCard,
        allowSort: true,
        getItemId: (item) => item.species_id,
        title: t("statistics"),
        errorTitle: t("stat_unavailable"),
        showUncheckWarning: false,
        icon: "stats-chart",
        iconOpposite: "checkbox-outline",
        noItemsMessage: t("no_stat_yet"),
      },
      checklist: {
        fetch: fetchChecklist,
        component: ChecklistCard,
        allowSort: false,
        getItemId: (item) => item.species_id ?? item.id,
        title: t("checklist"),
        errorTitle: t("checklist_unavailable"),
        showUncheckWarning: true,
        icon: "checkbox-outline",
        iconOpposite: "stats-chart",
        noItemsMessage: t("no_checklist_yet"),
      },
    }),
    [t],
  );
  const config = MODE_CONFIG[viewMode];

  const handleModeChange = useCallback(() => {
    const targetRoute = route.name === "Checklist" ? "Stat" : "Checklist";
    navigation.replace(targetRoute);
  }, [navigation, route.name]);

  const handleOpenFilterModal = useCallback((fn) => {
    openFilterModalRef.current = fn;
  }, []);

  const handleAdd = useCallback(() => {
    const defaultTerritory = currentFilters?.territory ?? territory ?? null;
    const defaultPlace = currentFilters?.place ?? null;
    navigation.navigate("ObservationEditor", {
      defaultTerritory,
      defaultPlace,
      returnMode: "back",
    });
  }, [navigation, currentFilters, territory]);

  const handleShowObservations = useCallback(
    (item) => {
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
    [navigation, currentFilters],
  );

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
    [currentFilters, navigation, config],
  );

  const noItems = useMemo(() => {
    const noTerritory = !currentFilters?.territory;
    const openFilter = () => openFilterModalRef.current?.();

    if (viewMode === "checklist" && noTerritory) {
      return {
        icon: "checkbox-outline",
        message: t("select_territory_to_view_checklist"),
        actions: [{ label: t("select_territory"), onPress: openFilter }],
      };
    }
    if (viewMode !== "checklist" && noTerritory && seenMode !== "seen") {
      return {
        icon: "stats-chart",
        message:
          seenMode === "unseen"
            ? t("select_territory_to_view_not_seen")
            : t("select_territory_to_view_all"),
        actions: [{ label: t("select_territory"), onPress: openFilter }],
      };
    }
    return {
      icon: config.icon,
      message: config.noItemsMessage,
      actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
    };
  }, [currentFilters, viewMode, seenMode, config, t, handleAdd]);

  const fetchData = useCallback(
    (filters, sort, search, page) => {
      const safeFilters = { ...filters };

      if (viewMode === "checklist" && !safeFilters.territory) {
        return Promise.resolve({ results: [], pagination: { count: 0 } });
      }
      if (
        viewMode !== "checklist" &&
        !safeFilters.territory &&
        seenMode !== "seen"
      ) {
        return Promise.resolve({ results: [], pagination: { count: 0 } });
      }

      safeFilters.seen =
        seenMode === "seen" ? true : seenMode === "unseen" ? false : null;
      return config.fetch(safeFilters, sort, search, page);
    },
    [seenMode, viewMode, config],
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
          personal={true}
        />
      );
    },
    [seenMode, handleStatCardPress, viewMode],
  );

  const headerRight = useCallback(
    () => (
      <IconButton
        icon={config.iconOpposite}
        onPress={handleModeChange}
        style={{ marginRight: 0 }}
        size={24}
        tintColor={Colors.textMain}
      />
    ),
    [config, handleModeChange, Colors],
  );

  return (
    <View style={{ flex: 1 }}>
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
        headerRightExtra={headerRight}
        onOpenFilterModal={handleOpenFilterModal}
      />
      <Tabs tabsMode={seenMode} setTabsMode={setSeenMode} />
      <ConfirmBottomSheet
        ref={confirmRef}
        type="warning"
        title={t("uncheck_title")}
        description={t("uncheck_descriptions")}
        confirmText={t("view_species_observations")}
        cancelText={t("cancel")}
        onConfirm={handleShowObservations}
      />
    </View>
  );
};

export default StatScreen;
