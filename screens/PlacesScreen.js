import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchPlaces } from "../util/fetches";
import PlaceCard from "../components/Place/PlaceCard";
import { useLocationCoords } from "../store/location-context";
import { useLocationUnavailable } from "../hooks/useLocationUnavailable";

const PlacesScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { locationCoords, locationAvailable, permissionStatus } = useLocationCoords();

  const fetchFunction = (filters, sort, search, page, openFilters, coords) =>
    fetchPlaces(filters, sort, search, page, coords);

  const handleLocationUnavailable = useLocationUnavailable();

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
      fetchFunction={fetchFunction}
      allowedFilters={["territory", "favourite"]}
      errorTitle={t("places_unavailable")}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      showSearch={true}
      title={t("places")}
      locationCoords={locationCoords}
      locationAvailable={locationAvailable}
      onLocationUnavailable={handleLocationUnavailable}
    />
  );
};

export default PlacesScreen;
