import { useTranslation } from "react-i18next";
import { useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import { fetchCommunityObservations } from "../util/fetches";
import { useLocation } from "../store/location-context";
import { useLocationUnavailable } from "../hooks/useLocationUnavailable";
import CommunityCard from "../components/Community/CommunityCard";
import { AppStackRouteProp, ObservationItem } from "../types";

const CommunityScreen = () => {
  const { t } = useTranslation();
  const route = useRoute<AppStackRouteProp<"Community">>();
  const { locationCoords, locationAvailable } = useLocation();

  const handleLocationUnavailable = useLocationUnavailable();

  const noItems = {
    icon: "binoculars-outline" as const,
    message: t("no_observations_yet"),
    actions: [],
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: ObservationItem;
    index: number;
  }) => <CommunityCard item={item} index={index} />;

  return (
    <ListScreen
      route={route}
      fetchFunction={fetchCommunityObservations}
      errorTitle={t("observations_unavailable")}
      renderItem={renderItem}
      noItems={noItems}
      locationCoords={locationCoords}
      locationAvailable={locationAvailable}
      onLocationUnavailable={handleLocationUnavailable}
      title={t("community")}
      allowedFilters={["territory", "date", "species"]}
    />
  );
};

export default CommunityScreen;
