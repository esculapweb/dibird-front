import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchDiaries } from "../util/fetches";
import DiaryCard from "../components/Diary/DiaryCard";
import { loadFilters } from "../util/storageHelper";

const DiariesScreen = ({route, navigation}) => {
  const { t } = useTranslation();

  const SORT_OPTIONS = [
    { label: t("date_sort_desc"), value: "-date_time" },
    { label: t("date_sort"), value: "date_time" },
    // { label: t("alphabetic"), value: "species_name" },
    // { label: t("alphabetic_desc"), value: "-species_name" },
    { label: t("observation_count"), value: "observation_count,name" },
    { label: t("observation_count_desc"), value: "-observation_count,name" },
  ];

  const handleAdd = useCallback(async () => {
    const filters = await loadFilters(route.name);
    const defaultTerritory = filters?.territory ?? null;
    navigation.navigate("DiaryEditor", { defaultTerritory });
  }, [navigation, route.name]);

  const noItems = {
    icon: "book-outline",
    message: t("no_diaries_yet"),
    actions: [{ label: t("add_first_diary"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }) => (
    <DiaryCard item={item} index={index} />
  );

  const keyExtractor = (item, _) => `${route.name}-${item.id}`;

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchDiaries}
      sortOptions={SORT_OPTIONS}
      allowedFilters={["territory", "place", "date", "species"]}
      errorTitle={t("diaries_unavailable")}
      onAdd={handleAdd}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      noItems={noItems}
      title={t("diaries")}
    />
  );
};

export default DiariesScreen;
