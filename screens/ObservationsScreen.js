import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchObservations } from "../util/fetches";
import ObservationCard from "../hooks/Observation/ObservationCard";

const ObservationsScreen = ({ route, navigation }) => {
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { label: t("date_sort_desc"), value: "-date_time" },
    { label: t("date_sort"), value: "date_time" },
    { label: t("taxonomic"), value: "ioc_id" },
    { label: t("taxonomic_desc"), value: "-ioc_id" },
    // { label: t("alphabetic"), value: "species_name" },
    // { label: t("alphabetic_desc"), value: "-species_name" },
  ];

  const handleAdd = () => navigation.navigate("ObservationEditor");

  const noItems = {
    icon: "binoculars-outline",
    message: t("no_observations_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchObservations}
      sortOptions={SORT_OPTIONS}
      allowedFilters={["territory", "place", "date"]} //species
      errorTitle={t("observations_unavailable")}
      onAdd={handleAdd}
      ItemCard={ObservationCard}
      noItems={noItems}
    />
  );
};

export default ObservationsScreen;
