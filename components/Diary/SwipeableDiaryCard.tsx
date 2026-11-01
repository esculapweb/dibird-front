import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import DiaryCard from "./DiaryCard";
import SwipeableRow, { SwipeAction, swipeA11yProps } from "../ui/SwipeableRow";
import { useTheme } from "../../store/theme-context";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import { useDeleteDiary } from "../../hooks/Diary/useOfflineDiary";
import { shareDiary } from "../../util/share";
import { AppStackNavigationProp, DiaryListItem } from "../../types";

// DiaryCard plus DiaryDetailScreen's edit/share/delete, one swipe away. The
// list is the user's own (myapi), so every row is editable.
const SwipeableDiaryCard = memo(
  ({ item, index }: { item: DiaryListItem; index: number }) => {
    const { t } = useTranslation();
    const { Colors } = useTheme();
    const navigation = useNavigation<AppStackNavigationProp>();
    const deleteMutation = useDeleteDiary();
    const confirmDelete = useConfirmDelete();

    const handleDelete = () =>
      confirmDelete({
        message: t("delete_diary_message"),
        runDelete: (callbacks) => deleteMutation.mutate(item.id, callbacks),
        tag: `SwipeableDiaryCard:deleteDiary:${item.id}`,
      });

    const leftActions: SwipeAction[] = [
      {
        icon: "share-social-outline",
        label: t("share"),
        color: Colors.actionShare,
        onPress: () => {
          void shareDiary(item, t);
        },
        testID: `diary-swipe-share-${item.id}`,
      },
    ];

    const rightActions: SwipeAction[] = [
      {
        icon: "create-outline",
        label: t("edit"),
        color: Colors.actionEdit,
        onPress: () => navigation.navigate("DiaryEditor", { diary: item }),
        testID: `diary-swipe-edit-${item.id}`,
      },
      {
        icon: "trash-outline",
        label: t("delete"),
        color: Colors.actionDelete,
        onPress: handleDelete,
        testID: `diary-swipe-delete-${item.id}`,
      },
    ];

    return (
      <SwipeableRow leftActions={leftActions} rightActions={rightActions}>
        <DiaryCard
          item={item}
          index={index}
          accessibility={swipeA11yProps([...leftActions, ...rightActions])}
        />
      </SwipeableRow>
    );
  },
);

export default SwipeableDiaryCard;
