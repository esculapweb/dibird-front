import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Share, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useNavigation, useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import { fetchStat, fetchChecklist } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import ChecklistCard from "../components/Stats/ChecklistCard";
import Tabs from "../components/ui/Tabs";
import { useFilters } from "../store/filters-context";
import { useProfile } from "../store/profile-context";
import { buildShareUrl, speciesDetails } from "../util/helpers";
import { parseDeepLinkParams } from "../util/parseDeepLinkParams";
import { BottomSheet } from "../services/bottomSheet";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  ChecklistItem,
  Filters,
  PaginatedResponse,
  emptyPaginatedResponse,
  SpeciesItem,
  seenMode,
} from "../types";

const StatScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Stat" | "Checklist">>();

  const openFilterModalRef = useRef<(() => void) | null>(null);
  const { territory, seenMode, setSeenMode } = useFilters();
  const [currentFilters, setCurrentFilters] = useState<Filters | null>({});
  const [currentSort, setCurrentSort] = useState<string | null>(null);
  const { profile } = useProfile();
  const { seenMode: initialSeenMode } = useMemo(
    () => parseDeepLinkParams(route.params),
    [],
  );

  const viewMode = route.name === "Checklist" ? "checklist" : "stats";

  const MODE_CONFIG = useMemo(
    () => ({
      stats: {
        fetch: fetchStat,
        component: StatCard,
        allowSort: true,
        getItemId: (item: SpeciesItem | ChecklistItem) =>
          (item as SpeciesItem).species_id,
        title: t("statistics"),
        errorTitle: t("stat_unavailable"),
        showUncheckWarning: false,
        icon: "stats-chart" as const,
        iconOpposite: "checkbox-outline" as const,
        noItemsMessage: t("no_stat_yet"),
      },
      checklist: {
        fetch: fetchChecklist,
        component: ChecklistCard,
        allowSort: false,
        getItemId: (item: SpeciesItem | ChecklistItem) =>
          (item as ChecklistItem).species_id ?? (item as ChecklistItem).id!,
        title: t("checklist"),
        errorTitle: t("checklist_unavailable"),
        showUncheckWarning: true,
        icon: "checkbox-outline" as const,
        iconOpposite: "stats-chart" as const,
        noItemsMessage: t("no_checklist_yet"),
      },
    }),
    [t],
  );
  const config = MODE_CONFIG[viewMode];

  useEffect(() => {
    if (initialSeenMode) {
      setSeenMode(initialSeenMode);
      navigation.setParams({ seenMode: undefined });
    }
  }, []);

  const handleOpenFilterModal = useCallback((fn: () => void) => {
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
    (item: SpeciesItem) => {
      navigation.navigate("Observations", {
        filtersOverride: {
          territory: currentFilters?.territory ?? null,
          place: currentFilters?.place ?? null,
          species: item.species_id,
          speciesName: item.sp_name_lang,
          date: currentFilters?.date ?? null,
        },
      });
    },
    [navigation, currentFilters],
  );

  const handleShowBottomSheet = (item: SpeciesItem) =>
    BottomSheet.show({
      title: t("uncheck_title"),
      description: t("uncheck_descriptions"),
      confirmText: t("view_species_observations"),
      cancelText: t("cancel"),
      onConfirm: () => handleShowObservations(item),
    });

  const handleStatCardPress = useCallback(
    (item: SpeciesItem | ChecklistItem) => {
      if (!item.seen) {
        navigation.navigate("ObservationEditor", {
          defaultTerritory: currentFilters?.territory ?? null,
          defaultPlace: currentFilters?.place ?? null,
          defaultSpecies: item.species_id,
          returnMode: "back",
        });
        return;
      }
      if (config.showUncheckWarning) {
        handleShowBottomSheet(item as SpeciesItem);
        return;
      }
      handleShowObservations(item as SpeciesItem);
    },
    [currentFilters, navigation, config],
  );

  const noItems = useMemo(() => {
    const noTerritory = !currentFilters?.territory;
    const openFilter = () => openFilterModalRef.current?.();

    if (viewMode === "checklist" && noTerritory) {
      return {
        icon: "checkbox-outline" as const,
        message: t("select_territory_to_view_checklist"),
        actions: [{ label: t("select_territory"), onPress: openFilter }],
      };
    }
    if (viewMode !== "checklist" && noTerritory && seenMode !== "seen") {
      return {
        icon: "stats-chart" as const,
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
    (
      filters: Filters | null,
      sort: string | null,
      search: string,
      page: number,
    ) => {
      const safeFilters = { ...filters };

      if (viewMode === "checklist" && !safeFilters.territory) {
        return Promise.resolve<PaginatedResponse<ChecklistItem>>(
          emptyPaginatedResponse(),
        );
      }
      if (
        viewMode !== "checklist" &&
        !safeFilters.territory &&
        seenMode !== "seen"
      ) {
        return Promise.resolve<PaginatedResponse<SpeciesItem>>(
          emptyPaginatedResponse(),
        );
      }

      safeFilters.seen =
        seenMode === "seen" ? true : seenMode === "unseen" ? false : null;
      return config.fetch(safeFilters, sort, search, page);
    },
    [seenMode, viewMode, config],
  );

  const handleBottomSheetMenu = (item: ChecklistItem | SpeciesItem) => {
    const seenItem = item.seen
      ? {
          label: t("view_species_observations"),
          icon: "binoculars" as const,
          onPress: () => {
            handleShowObservations(item as SpeciesItem);
            BottomSheet.hide();
          },
        }
      : {
          label: t("add_observation"),
          icon: "add-circle-outline" as const,
          onPress: () => {
            navigation.navigate("ObservationEditor", {
              defaultTerritory: currentFilters?.territory ?? null,
              defaultPlace: currentFilters?.place ?? null,
              defaultSpecies: item.species_id,
              returnMode: "back",
            });
            BottomSheet.hide();
          },
        };

    BottomSheet.showMenu({
      items: [
        seenItem,
        {
          label: t("species_details"),
          icon: "information-circle-outline" as const,
          onPress: () => {
            speciesDetails(item.segment);
            BottomSheet.hide();
          },
        },
      ],
    });
  };

  const renderItem = useCallback(
    ({ item, index }: { item: SpeciesItem | ChecklistItem; index: number }) => {
      if (viewMode === "checklist") {
        return (
          <ChecklistCard
            item={item as ChecklistItem}
            index={index}
            seenMode={seenMode}
            onToggle={() => handleStatCardPress(item)}
            onPress={() => handleBottomSheetMenu(item)}
          />
        );
      }
      return (
        <StatCard
          item={item as SpeciesItem}
          index={index}
          seenMode={seenMode}
          onToggle={() => handleStatCardPress(item)}
          onPress={() => handleBottomSheetMenu(item)}
          personal
        />
      );
    },
    [seenMode, handleStatCardPress, viewMode],
  );

  const handleShare = useCallback(async () => {
    if (!profile?.user) return;

    if (profile?.private) {
      Toast.show({
        type: "info",
        text1: t("profile_private"),
        text2: t("profile_private_share_hint_stat"),
      });
      return;
    }

    const url = buildShareUrl(
      `users/stat/${profile.user}/`,
      currentFilters,
      currentSort,
    );

    await Share.share(Platform.OS === "ios" ? { url } : { message: url });
  }, [profile, currentFilters, currentSort, t]);

  const tabOptions = [
    {
      value: "seen" as const,
      icon: "eye" as const,
      iconInactive: "eye-outline" as const,
      labelKey: t("seen"),
    },
    {
      value: "all" as const,
      icon: "apps" as const,
      iconInactive: "apps-outline" as const,
      labelKey: t("all"),
    },
    {
      value: "unseen" as const,
      icon: "eye-off" as const,
      iconInactive: "eye-off-outline" as const,
      labelKey: t("not_seen"),
    },
  ];

  return (
    <>
      <ListScreen
        route={route}
        fetchFunction={fetchData}
        title={config.title}
        errorTitle={config.errorTitle}
        renderItem={renderItem}
        noItems={noItems}
        tabsMode={seenMode}
        getItemId={config.getItemId}
        onFiltersChange={async (val) => setCurrentFilters(val)}
        onSortChange={async (val) => setCurrentSort(val)}
        allowSort={config.allowSort}
        handleSharePress={viewMode === "stats" ? handleShare : undefined}
        onOpenFilterModal={handleOpenFilterModal}
        bottomEl={
          <Tabs
            tabOptions={tabOptions}
            tabsMode={seenMode}
            setTabsMode={(val) => setSeenMode(val as seenMode)}
          />
        }
      />
    </>
  );
};

export default StatScreen;
