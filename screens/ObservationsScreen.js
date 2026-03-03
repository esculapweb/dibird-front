import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchObservations } from "../util/fetches";
import ObservationCard from "../components/Observation/ObservationCard";
import { loadFilters } from "../util/storageHelper";

const ObservationsScreen = ({ route, navigation }) => {
  const { t } = useTranslation();

  const handleAdd = useCallback(async () => {
    const filters = await loadFilters(route.name);
    const defaultTerritory = filters?.territory ?? null;
    navigation.navigate("ObservationEditor", { defaultTerritory });
  }, [navigation, route.name]);

  const noItems = {
    icon: "binoculars-outline",
    message: t("no_observations_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }) => (
    <ObservationCard item={item} index={index} />
  );

  const keyExtractor = (item, _) => `${route.name}-${item.id}`;

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchObservations}
      allowedFilters={["territory", "place", "date", "species"]}
      errorTitle={t("observations_unavailable")}
      onAdd={handleAdd}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      noItems={noItems}
      title={t("observations")}
    />
  );
};

export default ObservationsScreen;
