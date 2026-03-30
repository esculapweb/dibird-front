import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchRating } from "../util/fetches";
import RatingCard from "../components/Rating/RatingCard";
import { useFilters } from "../store/filters-context";

const RatingScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { territory } = useFilters();
  const [currentFilters, setCurrentFilters] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const handleToggle = useCallback((profileId) => {
    setSelectedIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : prev.length < 2
          ? [...prev, profileId]
          : prev,
    );
  }, []);

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

const handleCompare = useCallback(() => {
  if (selectedIds.length < 2) return;
  console.log('compare rating')
  // navigation.navigate("RatingCompare", { profileIds: selectedIds });
}, [selectedIds]);

  const noItems = {
    icon: "location-outline",
    message: t("no_rating_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }) => (
    <RatingCard
      item={item}
      index={index}
      isSelected={selectedIds.includes(item.profile_id)}
      onToggle={() => handleToggle(item.profile_id)}
    />
  );

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchRating}
      errorTitle={t("rating_unavailable")}
      allowedFilters={["territory", "date"]}
      onFiltersChange={setCurrentFilters}
      onAdd={handleCompare}
      renderItem={renderItem}
      getItemId={(item) => item.profile_id}
      noItems={noItems}
      title={t("rating")}
      fabIcon="people-outline"
    />
  );
};

export default RatingScreen;
