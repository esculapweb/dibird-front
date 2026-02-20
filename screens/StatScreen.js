import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchStat } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";

const StatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { label: t("taxonomic"), value: "ioc_id" },
    { label: t("taxonomic_desc"), value: "-ioc_id" },
    { label: t("alphabetic"), value: "name" },
    { label: t("alphabetic_desc"), value: "-name" },
    { label: t("date_sort_desc"), value: "-date_time" },
    { label: t("date_sort"), value: "date_time" },
  ];

  const handleAdd = () => navigation.navigate("ObservationEditor");

  const noItems = {
    icon: "stats-chart",
    message: t("no_stat_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchStat}
      sortOptions={SORT_OPTIONS}
      allowedFilters={["seen", "territory", "place", "date"]}
      errorTitle={t("stat_unavailable")}
      ItemCard={StatCard}
      noItems={noItems}
      title={t("statistics")}
    />
  );
};

export default StatScreen;
