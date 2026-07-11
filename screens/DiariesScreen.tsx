import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import { fetchDiaries } from "../util/fetches";
import DiaryCard from "../components/Diary/DiaryCard";
import { useFilters } from "../store/filters-context";
import { runDiarySync } from "../services/sync/diarySync";
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

  // Same defensive retry as ObservationsScreen: NetInfo's reconnect event can
  // be missed/racy, so opportunistically retry the queue whenever this screen
  // is focused rather than relying solely on the background listener.
  useFocusEffect(
    useCallback(() => {
      runDiarySync();
    }, []),
  );

  const handleAdd = useCallback(async () => {
    const defaultTerritory = currentFilters?.territory ?? territory ?? null;
    const defaultPlace = currentFilters?.place ?? null;
    navigation.navigate("DiaryEditor", { defaultTerritory, defaultPlace });
  }, [navigation, currentFilters, territory]);

  const noItems = {
    icon: "book-outline" as const,
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
      onFiltersChange={async (val) => setCurrentFilters(val)}
      onAdd={handleAdd}
      renderItem={renderItem}
      noItems={noItems}
      title={t("diaries")}
    />
  );
};

export default DiariesScreen;
