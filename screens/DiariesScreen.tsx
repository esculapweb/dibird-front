import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import { fetchDiaries } from "../util/fetches";
import DiaryCard from "../components/Diary/DiaryCard";
import { useFilters } from "../store/filters-context";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  DiaryListItem,
  Filters,
} from "../types";

const DiariesScreen = () => {
  const { t } = useTranslation();
  const { territory } = useFilters();
  const [currentFilters, setCurrentFilters] = useState<Filters | null>(null);
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Diaries">>();

  const handleAdd = useCallback(async () => {
    const defaultTerritory = currentFilters?.territory ?? territory ?? "";
    const defaultPlace = currentFilters?.place ?? null;
    navigation.navigate("DiaryEditor", { defaultTerritory, defaultPlace });
  }, [navigation, currentFilters, territory]);

  const noItems = {
    icon: "book-outline",
    message: t("no_diaries_yet"),
    actions: [{ label: t("add_first_diary"), onPress: handleAdd }],
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: DiaryListItem;
    index: number;
  }) => <DiaryCard item={item} index={index} />;

  return (
    <ListScreen
      route={route}
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
