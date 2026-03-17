import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchDiaries } from "../util/fetches";
import DiaryCard from "../components/Diary/DiaryCard";
import { loadFilters } from "../util/storageHelper";
import { useTerritory } from "../store/territory-context";

const DiariesScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { territory } = useTerritory();

  const handleAdd = useCallback(async () => {
    const filters = await loadFilters(route.name);
    const defaultTerritory = filters?.territory ?? territory ?? null;
    const defaultPlace = filters?.place ?? null;
    navigation.navigate("DiaryEditor", { defaultTerritory, defaultPlace });
  }, [navigation, route.name, territory]);

  const noItems = {
    icon: "book-outline",
    message: t("no_diaries_yet"),
    actions: [{ label: t("add_first_diary"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }) => (
    <DiaryCard item={item} index={index} />
  );

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchDiaries}
      allowedFilters={["territory", "place", "date", "species"]}
      errorTitle={t("diaries_unavailable")}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      title={t("diaries")}
    />
  );
};

export default DiariesScreen;
