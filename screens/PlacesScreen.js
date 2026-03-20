import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

import ListScreen from "./ListScreen";
import { fetchPlaces } from "../util/fetches";
import PlaceCard from "../components/Place/PlaceCard";
import { useLocationCoords } from "../store/location-context";

const PlacesScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { locationCoords, locationAvailable, permissionStatus } = useLocationCoords();

  const fetchFunction = (filters, sort, search, page, openFilters, coords) =>
    fetchPlaces(filters, sort, search, page, coords);

  const handleLocationUnavailable = () =>
    Alert.alert(t("location_unavailable"), t("location_unavailable_hint"));

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
      permissionStatus={permissionStatus}
      onLocationUnavailable={handleLocationUnavailable}
      fabOffset={76}
    />
  );
};

export default PlacesScreen;
