import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchPlaces } from "../util/fetches";
import PlaceCard from "../components/Place/PlaceCard";

const PlacesScreen = ({ route, navigation }) => {
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { label: t("alphabetic"), value: "name" },
    { label: t("alphabetic_desc"), value: "-name" },
    // { label: t("favourite_asc"), value: "favourite,name" },
    // { label: t("favourite_desc"), value: "-favourite,name" },
    // { label: t("territory_asc"), value: "territory,name" },
    // { label: t("territory_desc"), value: "-territory,name" },
    { label: t("species_count"), value: "species_count,name" },
    { label: t("species_count_desc"), value: "-species_count,name" },
    { label: t("observation_count"), value: "observation_count,name" },
    { label: t("observation_count_desc"), value: "-observation_count,name" },
    // { label: t("diary_count"), value: "diary_count" },
    // { label: t("diary_count_desc"), value: "-diary_count" },
  ];

  const handleAdd = () => navigation.navigate("PlaceEditor");

  const noItems = {
    icon: "location-outline",
    message: t("no_places_yet"),
    actions: [{ label: t("add_first_place"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }) => (
    <PlaceCard item={item} index={index} />
  );

  const keyExtractor = (item, _) => `${route.name}-${item.id}`;

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchPlaces}
      sortOptions={SORT_OPTIONS}
      allowedFilters={["territory", "favourite"]}
      errorTitle={t("places_unavailable")}
      onAdd={handleAdd}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      noItems={noItems}
      showSearch={true}
      title={t("places")}
    />
  );
};

export default PlacesScreen;
