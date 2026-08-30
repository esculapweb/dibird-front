import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import {
  fetchOnlyObservationAtPlace,
  fetchPlaces,
  fetchPlacesForMap,
} from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import PlaceCard from "../components/Place/PlaceCard";
import PlacesMap from "../components/Map/PlacesMap";
import EmptyState from "../components/Empty/EmptyState";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ViewSwitch from "../components/ui/ViewSwitch";
import { useLocation } from "../store/location-context";
import { useLocationUnavailable } from "../hooks/useLocationUnavailable";
import { useMapViewMode } from "../hooks/useMapViewMode";
import { BottomSheet } from "../services/bottomSheet";
import { PlaceFeatureProperties } from "../util/placeMapFeatures";
import {
  AllowedFilterKey,
  AppStackNavigationProp,
  AppStackRouteProp,
  Filters,
  PlaceItem,
} from "../types";

const LIST_FILTERS: AllowedFilterKey[] = [
  "territory",
  "date",
  "favourite",
  "radius",
  "unsynced",
];

// A place queued locally has no server row to aggregate, and a radius needs a
// GPS fix the map does not ask for — neither has a meaning here.
const MAP_FILTERS: AllowedFilterKey[] = ["territory", "date", "favourite"];

const PlacesScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Places">>();
  const { locationCoords, locationAvailable } = useLocation();
  const {
    viewMode,
    ready: viewModeReady,
    changeViewMode,
    options: viewModeOptions,
  } = useMapViewMode(route.name);

  // Lifted out of the map's ListScreen so the sheet can hand the date the user
  // is looking at to the screen it opens. Only the map instance reports: the
  // sheet exists nowhere else.
  const [mapFilters, setMapFilters] = useState<Filters | null>({});

  const handleLocationUnavailable = useLocationUnavailable();

  const handleAdd = () => navigation.navigate("PlaceEditor");

  // Only the date travels with the tap: the place itself already pins the
  // territory, and "favourite" is a places-only filter neither destination
  // knows how to show or clear.
  const carriedFilters: Filters = useMemo(
    () => (mapFilters?.date ? { date: mapFilters.date } : {}),
    [mapFilters?.date],
  );

  // Opening the place is the point of this screen, so it leads. Its
  // observations and species follow, each only when there are any — a list or
  // a stat screen filtered to a place with nothing in it is a dead end.
  const handleSelectPlace = useCallback(
    (place: PlaceFeatureProperties) => {
      BottomSheet.showMenu({
        title: place.name,
        items: [
          {
            label: t("map_open_place"),
            icon: "location-outline",
            testID: "map-open-place-button",
            onPress: () => {
              BottomSheet.hide();
              navigation.navigate("PlaceDetail", { placeId: place.id });
            },
          },
          ...(place.observation_count
            ? [
                {
                  label: t("map_show_place_observations", {
                    count: place.observation_count,
                  }),
                  icon: "binoculars-outline" as const,
                  testID: "map-place-observations-button",
                  onPress: async () => {
                    BottomSheet.hide();
                    // Same shortcut as the observations map: a single
                    // observation is opened rather than listed.
                    if (place.observation_count === 1) {
                      const observation = await fetchOnlyObservationAtPlace(
                        carriedFilters,
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
                    navigation.navigate("Observations", {
                      filtersOverride: { ...carriedFilters, place: place.id },
                    });
                  },
                },
              ]
            : []),
          ...(place.species_count
            ? [
                {
                  label: t("map_show_place_species", {
                    count: place.species_count,
                  }),
                  icon: "stats-chart-outline" as const,
                  testID: "map-place-species-button",
                  onPress: () => {
                    BottomSheet.hide();
                    // Same destination as PlaceDetailScreen's species card:
                    // the statistics screen narrowed to this place.
                    navigation.push("Stat", {
                      filtersOverride: { ...carriedFilters, place: place.id },
                      seenMode: "seen",
                    });
                  },
                },
              ]
            : []),
        ],
      });
    },
    [navigation, carriedFilters, t],
  );

  const noItems = {
    icon: "location-outline" as const,
    message: t("no_places_yet"),
    actions: [{ label: t("add_first_place"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }: { item: PlaceItem; index: number }) => (
    <PlaceCard item={item} index={index} />
  );

  const viewSwitch = (
    <ViewSwitch
      options={viewModeOptions}
      value={viewMode}
      onChange={changeViewMode}
      testIDPrefix="places-view"
    />
  );

  if (!viewModeReady) return <LoadingOverlay />;

  if (viewMode === "map") {
    return (
      <ListScreen<PlaceItem, "Places">
        // Both branches return a ListScreen in the same position, so without
        // distinct keys React keeps one instance and carries its hook state
        // across the switch (see ObservationsScreen for what that broke).
        key="map"
        route={route}
        fetchFunction={fetchPlacesForMap}
        // Distinct from the list mode's key: both instances are the "Places"
        // screen, and without this their react-query entries would collide.
        queryKeyExtra="map"
        // Points on a map have no order to speak of.
        allowSort={false}
        allowedFilters={MAP_FILTERS}
        errorTitle={t("places_unavailable")}
        onAdd={handleAdd}
        title={t("places")}
        staleTime={StaleTime.FIVE_MINUTES}
        topEl={viewSwitch}
        showSearch
        noItems={noItems}
        onFiltersChange={async (val) => setMapFilters(val)}
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
            // A place with no observations is still a place the user made, and
            // this is the screen that manages them.
            <PlacesMap
              places={places}
              onSelectPlace={handleSelectPlace}
              includeEmpty
            />
          )
        }
      />
    );
  }

  return (
    <ListScreen<PlaceItem, "Places">
      key="list"
      route={route}
      fetchFunction={fetchPlaces}
      allowedFilters={LIST_FILTERS}
      errorTitle={t("places_unavailable")}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      title={t("places")}
      locationCoords={locationCoords}
      locationAvailable={locationAvailable}
      onLocationUnavailable={handleLocationUnavailable}
      staleTime={StaleTime.FIVE_MINUTES}
      topEl={viewSwitch}
      showSearch
    />
  );
};

export default PlacesScreen;
