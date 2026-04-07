import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchObservations } from "../util/fetches";
import ObservationCard from "../components/Observation/ObservationCard";
import { useFilters } from "../store/filters-context";

const ObservationsScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { territory } = useFilters();
  const [currentFilters, setCurrentFilters] = useState({});

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
    icon: "binoculars-outline",
    message: t("no_observations_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }) => (
    <ObservationCard item={item} index={index} />
  );

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchObservations}
      errorTitle={t("observations_unavailable")}
      onFiltersChange={setCurrentFilters}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      title={t("observations")}
    />
  );
};

export default ObservationsScreen;
