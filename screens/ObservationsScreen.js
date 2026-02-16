import { useTranslation } from "react-i18next";

import Observations from "../components/Observation/Observations";
import { fetchObservations } from "../util/fetches";
import ListScreen from "./ListScreen";

const ObservationsScreen = ({ route, navigation }) => {
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { label: t("date_sort_desc"), value: "-date_time" },
    { label: t("date_sort"), value: "date_time" },
    { label: t("taxonomic"), value: "ioc_id" },
    { label: t("taxonomic_desc"), value: "-ioc_id" },
    { label: t("alphabetic"), value: "name" },
    { label: t("alphabetic_desc"), value: "-name" },
  ];

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchObservations}
      ListComponent={Observations}
      sortOptions={SORT_OPTIONS}
      allowedFilters={["territory", "place", "date"]} //species
      errorTitle={t("observations_unavailable")}
      onAdd={() => navigation.navigate("ObservationEditor")}
    />
  );
};

export default ObservationsScreen;
