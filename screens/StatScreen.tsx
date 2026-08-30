import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Share, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useNavigation, useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import { overflowButton } from "../components/ui/overflowMenu";
import {
  fetchStat,
  fetchChecklist,
  sortChecklistSpecies,
} from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import ChecklistCard from "../components/Stats/ChecklistCard";
import Tabs from "../components/ui/Tabs";
import ViewSwitch from "../components/ui/ViewSwitch";
import { useFilters } from "../store/filters-context";
import { useProfile } from "../store/profile-context";
import { buildShareUrl } from "../util/helpers";
import { useOpenSpecies } from "../hooks/useOpenSpecies";
import { track } from "../services/analytics";
import { parseDeepLinkParams } from "../util/parseDeepLinkParams";
import { BottomSheet } from "../services/bottomSheet";
import { StaleTime } from "../constants/staleTime";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  ChecklistItem,
  Filters,
  PaginatedResponse,
  emptyPaginatedResponse,
  SpeciesItem,
  seenMode,
  StatPaginatedResponse,
} from "../types";

const StatScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const openSpecies = useOpenSpecies();
  const route = useRoute<AppStackRouteProp<"Stat" | "Checklist">>();

  const openFilterRef = useRef<(() => void) | null>(null);
  const { territory, seenMode, setSeenMode } = useFilters();
  const [currentFilters, setCurrentFilters] = useState<Filters | null>({});
  const [currentSort, setCurrentSort] = useState<string | null>(null);
  const { profile } = useProfile();
  const { seenMode: initialSeenMode } = useMemo(
    () => parseDeepLinkParams(route.params),
    [],
  );
  const [speciesCounts, setSpeciesCounts] = useState<{
    seen: number;
    total: number;
  } | null>(null);

  const handleFirstPageData = useCallback(
    (page: StatPaginatedResponse<SpeciesItem | ChecklistItem>) => {
      const total =
        typeof page.total_species === "number" ? page.total_species : 0;
      const seen =
        typeof page.seen_species === "number" ? page.seen_species : 0;
      setSpeciesCounts({ seen, total });
    },
    [],
  );

  const viewMode = route.name === "Checklist" ? "checklist" : "stats";
  // How the checklist is laid out: the taxonomic tree it has always been, or
  // a plain list of species. Same switch as the country page's species tab.
  const [checklistView, setChecklistView] = useState<"tree" | "flat">("tree");
  const isFlatChecklist = viewMode === "checklist" && checklistView === "flat";

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
        staleTime: StaleTime.FIVE_MINUTES,
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
        staleTime: StaleTime.TEN_MINUTES,
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

  const handleAdd = useCallback(() => {
    // undefined, not null — see ObservationsScreen: it lets the editor fall
    // back to the last saved/profile country instead of opening empty.
    const defaultTerritory = currentFilters?.territory ?? territory ?? undefined;
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

  const handleShowBottomSheet = useCallback(
    (item: SpeciesItem) =>
      BottomSheet.show({
        title: t("uncheck_title"),
        description: t("uncheck_descriptions"),
        confirmText: t("view_species_observations"),
        cancelText: t("cancel"),
        onConfirm: () => handleShowObservations(item),
      }),
    [t, handleShowObservations],
  );

  const handleStatCardPress = useCallback(
    (item: SpeciesItem | ChecklistItem) => {
      if (!item.seen) {
        navigation.navigate("ObservationEditor", {
          defaultTerritory: currentFilters?.territory ?? undefined,
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
    [
      currentFilters,
      navigation,
      config,
      handleShowBottomSheet,
      handleShowObservations,
    ],
  );

  const noItems = useMemo(() => {
    const noTerritory = !currentFilters?.territory;
    const openFilter = () => openFilterRef.current?.();

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

      const response = config.fetch(safeFilters, sort, search, page);
      if (!isFlatChecklist) return response;

      // The plain list is the same response with its group headers dropped
      // and sorted here: /myapi/checklist2/ answers in taxonomic order and in
      // one page, so there is nothing to ask the server for.
      return response.then((res) => ({
        ...res,
        results: sortChecklistSpecies(
          (res.results as ChecklistItem[]).filter(
            (row) => row.type === "species",
          ),
          sort,
        ),
      }));
    },
    [seenMode, viewMode, config, isFlatChecklist],
  );

  const handleBottomSheetMenu = useCallback(
    (item: ChecklistItem | SpeciesItem) => {
      const seenItem = item.seen
        ? {
            label: t("view_species_observations"),
            icon: "binoculars" as const,
            onPress: () => {
              // Close first, navigate second: navigating can take the screen
              // that owns the sheet out of the stack, and the sheet's own route
              // watcher closes it on that — a hide() coming after would land on
              // an already closed sheet.
              BottomSheet.hide();
              handleShowObservations(item as SpeciesItem);
            },
          }
        : {
            label: t("add_observation"),
            icon: "add-circle-outline" as const,
            onPress: () => {
              BottomSheet.hide();
              navigation.navigate("ObservationEditor", {
                defaultTerritory: currentFilters?.territory ?? undefined,
                defaultPlace: currentFilters?.place ?? null,
                defaultSpecies: item.species_id,
                returnMode: "back",
              });
            },
          };

      BottomSheet.showMenu({
        items: [
          seenItem,
          {
            label: t("species_details"),
            icon: "information-circle-outline" as const,
            onPress: () => {
              BottomSheet.hide();
              openSpecies(item.segment, "stat");
            },
          },
        ],
      });
    },
    [t, currentFilters, navigation, handleShowObservations, openSpecies],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: SpeciesItem | ChecklistItem; index: number }) => {
      if (viewMode === "checklist") {
        return (
          <ChecklistCard
            item={item as ChecklistItem}
            index={index}
            onToggle={() => handleStatCardPress(item)}
            onPress={() => handleBottomSheetMenu(item)}
            // The row's tap keeps its menu — "seen"/"my observations" are
            // what this screen is for — while the picture goes straight to
            // the reference, the same as everywhere else.
            onSpeciesPress={() => openSpecies(item.segment, "stat")}
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
          onSpeciesPress={() => openSpecies(item.segment, "stat")}
          personal
        />
      );
    },
    [seenMode, handleStatCardPress, handleBottomSheetMenu, viewMode, openSpecies],
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

    track("share_tapped", { type: "stat" });
    await Share.share(Platform.OS === "ios" ? { url } : { message: url });
  }, [profile, currentFilters, currentSort, t]);

  // The share link points at the stats page; in checklist mode there is
  // nothing to point at, and the menu disappears with its only row.
  const headerRightEnd = useMemo(
    () => [
      overflowButton([
        {
          condition: viewMode === "stats",
          label: t("share"),
          icon: "share-social-outline",
          onPress: () => {
            void handleShare();
          },
        },
      ]),
    ],
    [t, handleShare, viewMode],
  );

  const customHeaderBadge = useCallback(
    (
      res: StatPaginatedResponse<SpeciesItem | ChecklistItem>,
    ): number | string | undefined => {
      if (
        typeof res?.seen_species !== "number" ||
        typeof res?.total_species !== "number"
      ) {
        return undefined;
      }
      return `${res.seen_species} / ${res.total_species}`;
    },
    [],
  );


  const tabOptions = [
    {
      value: "seen" as const,
      icon: "eye" as const,
      iconInactive: "eye-outline" as const,
      labelKey: t("seen"),
      count: speciesCounts?.seen ?? undefined,
    },
    {
      value: "all" as const,
      icon: "apps" as const,
      iconInactive: "apps-outline" as const,
      labelKey: t("all"),
      count: speciesCounts?.total ?? undefined,
    },
    {
      value: "unseen" as const,
      icon: "eye-off" as const,
      iconInactive: "eye-off-outline" as const,
      labelKey: t("not_seen"),
      count:
        speciesCounts !== null
          ? speciesCounts.total - speciesCounts.seen
          : undefined,
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
        allowSort={config.allowSort || isFlatChecklist}
        // The layout lives in fetchData's closure, so without it in the key
        // the switch would keep showing the pages fetched for the tree.
        queryKeyExtra={viewMode === "checklist" ? checklistView : null}
        staleTime={config.staleTime}
        headerRightEnd={headerRightEnd}
        onOpenFilterModal={(fn) => {
          openFilterRef.current = fn;
        }}
        customHeaderBadge={customHeaderBadge}
        onFirstPageData={handleFirstPageData}
        listHeader={
          viewMode === "checklist" ? (
            <ViewSwitch
              options={[
                {
                  value: "tree",
                  label: t("by_groups"),
                  icon: "git-branch-outline",
                },
                { value: "flat", label: t("as_list"), icon: "list-outline" },
              ]}
              value={checklistView}
              onChange={setChecklistView}
              testIDPrefix="checklist-view"
            />
          ) : undefined
        }
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
