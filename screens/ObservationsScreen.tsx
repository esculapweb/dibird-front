import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import {
  fetchObservationPlaces,
  fetchObservations,
  fetchOnlyObservationAtPlace,
} from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import ObservationCard from "../components/Observation/ObservationCard";
import PlacesMap from "../components/Map/PlacesMap";
import NoPlaceObservationsNote from "../components/Observation/NoPlaceObservationsNote";
import EmptyState from "../components/Empty/EmptyState";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ViewSwitch from "../components/ui/ViewSwitch";
import { useFilters } from "../store/filters-context";
import { runObservationSync } from "../services/sync/observationSync";
import { useMapViewMode } from "../hooks/useMapViewMode";
import {
  PlaceFeatureProperties,
  countTotal,
  placesToFeatureCollection,
} from "../util/placeMapFeatures";
import { BottomSheet } from "../services/bottomSheet";
import {
  AllowedFilterKey,
  AppStackNavigationProp,
  AppStackRouteProp,
  Filters,
  ObservationItem,
  PlaceItem,
} from "../types";

const LIST_FILTERS: AllowedFilterKey[] = [
  "territory",
  "place",
  "date",
  "species",
  "private",
  "has_photo",
  "unsynced",
];

// The map reads places, and neither of the two filters left out here narrows
// a place: "unsynced" only ever means an observation queued locally (such a
// record has no aggregated server row to draw), and "has_photo" is a property
// of a single observation, which /myapi/place2/ does not aggregate.
const MAP_FILTERS: AllowedFilterKey[] = [
  "territory",
  "place",
  "date",
  "species",
  "private",
];

const ObservationsScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Observations">>();
  const { territory } = useFilters();
  const [currentFilters, setCurrentFilters] = useState<Filters | null>({});
  const {
    viewMode,
    ready: viewModeReady,
    changeViewMode,
    options: viewModeOptions,
  } = useMapViewMode(route.name);

  // Defends against NetInfo's reconnect event being missed/racy right around
  // an offline->online transition (the background sync in useObservationSync
  // relies on that same event): opportunistically retry the queue whenever
  // this screen is actually looked at, so a pending item's status doesn't get
  // stuck showing "offline" for the rest of the session.
  useFocusEffect(
    useCallback(() => {
      runObservationSync();
    }, []),
  );

  const handleAdd = useCallback(async () => {
    // undefined, not null: no filter here means "nothing to say", which lets
    // the editor fall back to the last saved/profile country. null would tell
    // it to leave the field empty (see ObservationEditorScreen).
    const defaultTerritory = currentFilters?.territory ?? territory ?? undefined;
    const defaultPlace = currentFilters?.place ?? null;
    const defaultSpecies = currentFilters?.species ?? null;
    navigation.navigate("ObservationEditor", {
      defaultTerritory,
      defaultPlace,
      defaultSpecies,
    });
  }, [navigation, currentFilters, territory]);

  // Opening a place from the map hands the choice back to the list rather than
  // rebuilding one in the sheet: filtersOverride is the same route param deep
  // links use, so the list arrives already narrowed to that place.
  //
  // setParams, not navigate: this screen is already the current route, so
  // navigating to it would only rewrite params without remounting anything —
  // and the map instance has long since consumed its override. Setting the
  // param and then flipping the mode lets the list instance, which mounts
  // fresh under its own key, pick it up on the way in.
  //
  // The sheet never closes itself (see UniversalBottomSheet's menu mode) —
  // every item has to dismiss it, as StatScreen's rows do.
  const handleSelectPlace = useCallback(
    (place: PlaceFeatureProperties) => {
      BottomSheet.showMenu({
        title: place.name,
        items: [
          {
            label: t("map_show_place_observations", {
              count: place.observation_count,
            }),
            icon: "binoculars-outline",
            onPress: async () => {
              BottomSheet.hide();
              // A list of one row is a stop with nothing to choose: go where
              // that row goes. Falls through to the list when the single
              // observation cannot be resolved (see fetchOnlyObservationAtPlace).
              if (place.observation_count === 1) {
                const observation = await fetchOnlyObservationAtPlace(
                  currentFilters ?? {},
                  place.id,
                );
                if (observation) {
                  navigation.navigate("ObservationDetail", {
                    observationId: observation.id,
                    initialObservation: observation,
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

  const viewSwitch = (
    <ViewSwitch
      options={viewModeOptions}
      value={viewMode}
      onChange={changeViewMode}
      testIDPrefix="observations-view"
    />
  );

  const noItems = {
    icon: "binoculars-outline" as const,
    message: t("no_observations_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: ObservationItem;
    index: number;
  }) => <ObservationCard item={item} index={index} />;

  if (!viewModeReady) return <LoadingOverlay />;

  if (viewMode === "map") {
    return (
      <ListScreen<PlaceItem, "Observations">
        // Both branches return a ListScreen in the same position, so without
        // distinct keys React keeps one instance and carries its hook state
        // across the switch: the list's sort would reach the places endpoint
        // (which rejects it), and useList's keepPreviousData would hand the
        // map a stale page of observations to plot.
        key="map"
        route={route}
        fetchFunction={fetchObservationPlaces}
        // Distinct from the list mode's key: both instances are the
        // "Observations" screen, and without this their react-query entries
        // would collide (see useList).
        queryKeyExtra="map"
        // Places on a map have no order to speak of.
        allowSort={false}
        allowedFilters={MAP_FILTERS}
        errorTitle={t("observations_unavailable")}
        onFiltersChange={async (val) => setCurrentFilters(val)}
        onAdd={handleAdd}
        title={t("observations")}
        staleTime={StaleTime.TWO_MINUTES}
        // The note rides above the map rather than in bottomEl: it comes and
        // goes with the filters, and a disappearing bottom element would keep
        // shifting the add button.
        topEl={
          <>
            {viewSwitch}
            <NoPlaceObservationsNote filters={currentFilters} />
          </>
        }
        // The badge counts what is actually plotted, so it agrees with the
        // dots: places the map drops (no coordinates) don't inflate it.
        customHeaderBadge={(page) =>
          countTotal(placesToFeatureCollection(page.results))
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
            <PlacesMap places={places} onSelectPlace={handleSelectPlace} />
          )
        }
      />
    );
  }

  return (
    <ListScreen<ObservationItem, "Observations">
      key="list"
      route={route}
      fetchFunction={fetchObservations}
      allowedFilters={LIST_FILTERS}
      errorTitle={t("observations_unavailable")}
      onFiltersChange={async (val) => setCurrentFilters(val)}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      title={t("observations")}
      staleTime={StaleTime.TWO_MINUTES}
      topEl={viewSwitch}
    />
  );
};

export default ObservationsScreen;
