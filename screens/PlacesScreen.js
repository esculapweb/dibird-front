import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchPlaces } from "../util/fetches";
import PlaceCard from "../components/Place/PlaceCard";
import { useLocation } from "../store/location-context";
import { useLocationUnavailable } from "../hooks/useLocationUnavailable";

const PlacesScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { locationCoords, locationAvailable } = useLocation();

  const fetchFunction = (filters, sort, search, page, coords) =>
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
      fetchFunction={fetchFunction}
      allowedFilters={["territory", "favourite"]}
      errorTitle={t("places_unavailable")}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      title={t("places")}
      locationCoords={locationCoords}
      locationAvailable={locationAvailable}
      onLocationUnavailable={handleLocationUnavailable}
      showSearch
    />
  );
};

export default PlacesScreen;
