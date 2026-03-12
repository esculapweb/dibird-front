import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchPlaces } from "../util/fetches";
import PlaceCard from "../components/Place/PlaceCard";

const PlacesScreen = ({ route, navigation }) => {
  const { t } = useTranslation();

  const handleAdd = () => navigation.navigate("PlaceEditor");

  const noItems = {
    icon: "location-outline",
    message: t("no_places_yet"),
    actions: [{ label: t("add_first_place"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }) => (
    <PlaceCard item={item} index={index} />
  );

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchPlaces}
      allowedFilters={["territory", "favourite"]}
      errorTitle={t("places_unavailable")}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      showSearch={true}
      title={t("places")}
    />
  );
};

export default PlacesScreen;
