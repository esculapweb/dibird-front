import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import ListScreen from "./ListScreen";
import { fetchDiaries } from "../util/fetches";
import DiaryCard from "../components/Diary/DiaryCard";
import { useFilters } from "../store/filters-context";

const DiariesScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { territory } = useFilters();
  const [currentFilters, setCurrentFilters] = useState(null);

  const handleAdd = useCallback(async () => {
    const defaultTerritory = currentFilters?.territory ?? territory ?? null;
    const defaultPlace = currentFilters?.place ?? null;
    navigation.navigate("DiaryEditor", { defaultTerritory, defaultPlace });
  }, [navigation, currentFilters, territory]);

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
      errorTitle={t("diaries_unavailable")}
      onFiltersChange={setCurrentFilters}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      title={t("diaries")}
    />
  );
};

export default DiariesScreen;
