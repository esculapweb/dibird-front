import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import {
  fetchDiaries,
  fetchDiaryPlaces,
  fetchOnlyDiaryAtPlace,
} from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import DiaryCard from "../components/Diary/DiaryCard";
import PlacesMap from "../components/Map/PlacesMap";
import EmptyState from "../components/Empty/EmptyState";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ViewSwitch from "../components/ui/ViewSwitch";
import { useFilters } from "../store/filters-context";
import { useMapViewMode } from "../hooks/useMapViewMode";
import { runDiarySync } from "../services/sync/diarySync";
import { BottomSheet } from "../services/bottomSheet";
import { DIARY_SCALE } from "../constants/mapSymbolScale";
import {
  PlaceFeatureProperties,
  countTotal,
  placesToFeatureCollection,
} from "../util/placeMapFeatures";
import {
  AllowedFilterKey,
  AppStackNavigationProp,
  AppStackRouteProp,
  DiaryListItem,
  Filters,
  PlaceItem,
} from "../types";

const LIST_FILTERS: AllowedFilterKey[] = [
  "territory",
  "place",
  "date",
  "species",
  "private",
  "unsynced",
];

// The map reads places, and "unsynced" only ever means a diary queued locally —
// such a record has no aggregated server row to draw. `species` is gone too:
// a species belongs to an observation, not to the outing itself, so the server
// cannot narrow diary_place_count by it (see Place2ViewSet._get_diary_q).
const MAP_FILTERS: AllowedFilterKey[] = [
  "territory",
  "place",
  "date",
  "private",
];

const DiariesScreen = () => {
  const { t } = useTranslation();
  const { territory } = useFilters();
  const [currentFilters, setCurrentFilters] = useState<Filters | null>(null);
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Diaries">>();
  const {
    viewMode,
    ready: viewModeReady,
    changeViewMode,
    options: viewModeOptions,
  } = useMapViewMode(route.name);

  // Same defensive retry as ObservationsScreen: NetInfo's reconnect event can
  // be missed/racy, so opportunistically retry the queue whenever this screen
  // is focused rather than relying solely on the background listener.
  useFocusEffect(
    useCallback(() => {
      runDiarySync();
    }, []),
  );

  const handleAdd = useCallback(async () => {
    // undefined, not null — see ObservationsScreen: it lets the editor fall
    // back to the last saved/profile country instead of opening empty.
    const defaultTerritory = currentFilters?.territory ?? territory ?? undefined;
    const defaultPlace = currentFilters?.place ?? null;
    navigation.navigate("DiaryEditor", { defaultTerritory, defaultPlace });
  }, [navigation, currentFilters, territory]);

  // Same move as the observations map: hand the choice back to the list rather
  // than rebuilding one in the sheet. setParams, not navigate — this screen is
  // already the current route, so navigating to it would only rewrite params
  // without remounting, and the map instance consumed its override long ago.
  const handleSelectPlace = useCallback(
    (place: PlaceFeatureProperties) => {
      BottomSheet.showMenu({
        title: place.name,
        items: [
          {
            label: t("map_show_place_diaries", {
              count: place.diary_place_count,
            }),
            icon: "book-outline",
            onPress: async () => {
              // Same shortcut as the observations map: one outing needs no
              // list to pick it out of.
              BottomSheet.hide();
              if (place.diary_place_count === 1) {
                const diary = await fetchOnlyDiaryAtPlace(
                  currentFilters ?? {},
                  place.id,
                );
                if (diary) {
                  navigation.navigate("DiaryDetail", {
                    diaryId: diary.id,
                    initialDiary: diary,
                  });
                  return;
                }
              }
              navigation.setParams({
                filtersOverride: { ...currentFilters, place: place.id },
              });
              changeViewMode("list");
            },
          },
          {
            label: t("map_open_place"),
            icon: "location-outline",
            onPress: () => {
              BottomSheet.hide();
              navigation.navigate("PlaceDetail", { placeId: place.id });
            },
          },
        ],
      });
    },
    [navigation, currentFilters, changeViewMode, t],
  );

  const noItems = {
    icon: "book-outline" as const,
    message: t("no_diaries_yet"),
    actions: [{ label: t("add_first_diary"), onPress: handleAdd }],
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: DiaryListItem;
    index: number;
  }) => <DiaryCard item={item} index={index} />;

  const viewSwitch = (
    <ViewSwitch
      options={viewModeOptions}
      value={viewMode}
      onChange={changeViewMode}
      testIDPrefix="diaries-view"
    />
  );

  if (!viewModeReady) return <LoadingOverlay />;

  if (viewMode === "map") {
    return (
      <ListScreen<PlaceItem, "Diaries">
        // Both branches return a ListScreen in the same position, so without
        // distinct keys React keeps one instance and carries its hook state
        // across the switch (see ObservationsScreen for what that broke).
        key="map"
        route={route}
        fetchFunction={fetchDiaryPlaces}
        // Distinct from the list mode's key: both instances are the "Diaries"
        // screen, and without this their react-query entries would collide.
        queryKeyExtra="map"
        // Points on a map have no order to speak of.
        allowSort={false}
        allowedFilters={MAP_FILTERS}
        errorTitle={t("diaries_unavailable")}
        onFiltersChange={async (val) => setCurrentFilters(val)}
        onAdd={handleAdd}
        title={t("diaries")}
        staleTime={StaleTime.TWO_MINUTES}
        topEl={viewSwitch}
        // Counts what is actually plotted, so the badge agrees with the dots.
        customHeaderBadge={(page) =>
          countTotal(
            placesToFeatureCollection(page.results, {
              countProperty: "diary_place_count",
            }),
            "diary_place_count",
          )
        }
        noItems={noItems}
        // Never called — renderContent takes over from the list entirely.
        renderItem={() => null}
        renderContent={(places, empty) =>
          places.length === 0 ? (
            <EmptyState
              {...(empty.type === "filtered"
                ? {
                    icon: "search-outline" as const,
                    message: t("nothing_found"),
                    actions: [
                      { label: t("reset_filters"), onPress: empty.onClear },
                    ],
                  }
                : noItems)}
            />
          ) : (
            <PlacesMap
              places={places}
              onSelectPlace={handleSelectPlace}
              scale={DIARY_SCALE}
            />
          )
        }
      />
    );
  }

  return (
    <ListScreen<DiaryListItem, "Diaries">
      key="list"
      route={route}
      fetchFunction={fetchDiaries}
      allowedFilters={LIST_FILTERS}
      errorTitle={t("diaries_unavailable")}
      onFiltersChange={async (val) => setCurrentFilters(val)}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      title={t("diaries")}
      staleTime={StaleTime.TWO_MINUTES}
      topEl={viewSwitch}
    />
  );
};

export default DiariesScreen;
