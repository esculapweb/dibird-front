import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import DiaryObservationCard from "./DiaryObservationCard";
import SwipeableRow, { SwipeAction, swipeA11yProps } from "../ui/SwipeableRow";
import { useTheme } from "../../store/theme-context";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import { useDeleteObservation } from "../../hooks/Observation/useOfflineObservation";
import { AppStackNavigationProp, DiaryObservationItem } from "../../types";

// Edit and delete, for the diary's owner. No share: the row is the diary
// list's trimmed shape, without the `private` flag that decides whether the
// link would open at all. For the same reason the editor is handed only the
// id and loads the full observation itself.
const SwipeableDiaryObservationCard = memo(
  ({
    item,
    index,
    owner,
    diaryId,
    territoryValue,
  }: {
    item: DiaryObservationItem;
    index: number;
    owner: boolean;
    diaryId: number;
    territoryValue: number;
  }) => {
    const { t } = useTranslation();
    const { Colors } = useTheme();
    const navigation = useNavigation<AppStackNavigationProp>();
    const deleteMutation = useDeleteObservation();
    const confirmDelete = useConfirmDelete();

    const rightActions: SwipeAction[] = owner
      ? [
          {
            icon: "create-outline",
            label: t("edit"),
            color: Colors.actionEdit,
            // The diary params ObservationDetailScreen's edit button passes
            // for an observation inside a diary.
            onPress: () =>
              navigation.navigate("ObservationEditor", {
                observationId: item.id,
                diaryId,
                territoryValue,
              }),
            testID: `diary-observation-swipe-edit-${item.id}`,
          },
          {
            icon: "trash-outline",
            label: t("delete"),
            color: Colors.actionDelete,
            onPress: () =>
              confirmDelete({
                message: t("delete_observation_message"),
                runDelete: (callbacks) =>
                  deleteMutation.mutate(item.id, callbacks),
                tag: `SwipeableDiaryObservationCard:deleteObservation:${item.id}`,
              }),
            testID: `diary-observation-swipe-delete-${item.id}`,
          },
        ]
      : [];

    return (
      <SwipeableRow rightActions={rightActions}>
        <DiaryObservationCard
          item={item}
          index={index}
          owner={owner}
          accessibility={swipeA11yProps(rightActions)}
        />
      </SwipeableRow>
    );
  },
);

export default SwipeableDiaryObservationCard;
