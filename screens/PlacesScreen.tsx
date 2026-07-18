import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import { fetchPlaces } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import PlaceCard from "../components/Place/PlaceCard";
import { useLocation } from "../store/location-context";
import { useLocationUnavailable } from "../hooks/useLocationUnavailable";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  PlaceItem,
} from "../types";

const PlacesScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Places">>();
  const { locationCoords, locationAvailable } = useLocation();

  const handleLocationUnavailable = useLocationUnavailable();

  const handleAdd = () => navigation.navigate("PlaceEditor");

  const noItems = {
    icon: "location-outline" as const,
    message: t("no_places_yet"),
    actions: [{ label: t("add_first_place"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }: { item: PlaceItem; index: number }) => (
    <PlaceCard item={item} index={index} />
  );

  return (
    <ListScreen
      route={route}
      fetchFunction={fetchPlaces}
      allowedFilters={["territory", "date", "favourite", "unsynced"]}
      errorTitle={t("places_unavailable")}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      title={t("places")}
      locationCoords={locationCoords}
      locationAvailable={locationAvailable}
      onLocationUnavailable={handleLocationUnavailable}
      staleTime={StaleTime.FIVE_MINUTES}
      showSearch
    />
  );
};

export default PlacesScreen;
