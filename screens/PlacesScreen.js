import { useTranslation } from "react-i18next";

import Places from "../components/Place/Places";
import { fetchPlaces } from "../util/fetches";
import ListScreen from "./ListScreen";

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

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchPlaces}
      ListComponent={Places}
      sortOptions={SORT_OPTIONS}
      allowedFilters={["territory", "favourite"]}
      errorTitle={t("places_unavailable")}
      onAdd={() => navigation.navigate("PlaceEditor")}
    />
  );
};

export default PlacesScreen;
