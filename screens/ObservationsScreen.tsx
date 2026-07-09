import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import { fetchObservations } from "../util/fetches";
import ObservationCard from "../components/Observation/ObservationCard";
import { useFilters } from "../store/filters-context";
import { runObservationSync } from "../services/sync/observationSync";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  Filters,
  ObservationItem,
} from "../types";

const ObservationsScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Observations">>();
  const { territory } = useFilters();
  const [currentFilters, setCurrentFilters] = useState<Filters | null>({});

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
    const defaultTerritory = currentFilters?.territory ?? territory ?? null;
    const defaultPlace = currentFilters?.place ?? null;
    const defaultSpecies = currentFilters?.species ?? null;
    navigation.navigate("ObservationEditor", {
      defaultTerritory,
      defaultPlace,
      defaultSpecies,
    });
  }, [navigation, currentFilters, territory]);

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

  return (
    <ListScreen
      route={route}
      fetchFunction={fetchObservations}
      errorTitle={t("observations_unavailable")}
      onFiltersChange={async (val) => setCurrentFilters(val)}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      title={t("observations")}
    />
  );
};

export default ObservationsScreen;
