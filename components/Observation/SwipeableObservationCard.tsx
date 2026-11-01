import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import ObservationCard from "./ObservationCard";
import SwipeableRow, { SwipeAction, swipeA11yProps } from "../ui/SwipeableRow";
import { useTheme } from "../../store/theme-context";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import { useDeleteObservation } from "../../hooks/Observation/useOfflineObservation";
import { shareObservation } from "../../util/share";
import { AppStackNavigationProp, ObservationItem } from "../../types";

// ObservationCard plus ObservationDetailScreen's edit/share/delete, one swipe
// away. The list is the user's own (myapi), so every row is editable.
const SwipeableObservationCard = memo(
  ({ item, index }: { item: ObservationItem; index: number }) => {
    const { t } = useTranslation();
    const { Colors } = useTheme();
    const navigation = useNavigation<AppStackNavigationProp>();
    const deleteMutation = useDeleteObservation();
    const confirmDelete = useConfirmDelete();

    // Same params as ObservationDetailScreen's edit button.
    const handleEdit = () =>
      navigation.navigate("ObservationEditor", {
        observation: item,
        ...(item.diary && {
          diaryId: item.diary,
          territoryValue: item.territory ?? undefined,
        }),
      });

    const handleDelete = () =>
      confirmDelete({
        message: t("delete_observation_message"),
        runDelete: (callbacks) => deleteMutation.mutate(item.id, callbacks),
        tag: `SwipeableObservationCard:deleteObservation:${item.id}`,
      });

    const leftActions: SwipeAction[] = [
      {
        icon: "share-social-outline",
        label: t("share"),
        color: Colors.actionShare,
        onPress: () => {
          void shareObservation(item, t);
        },
        testID: `observation-swipe-share-${item.id}`,
      },
    ];

    const rightActions: SwipeAction[] = [
      {
        icon: "create-outline",
        label: t("edit"),
        color: Colors.actionEdit,
        onPress: handleEdit,
        testID: `observation-swipe-edit-${item.id}`,
      },
      {
        icon: "trash-outline",
        label: t("delete"),
        color: Colors.actionDelete,
        onPress: handleDelete,
        testID: `observation-swipe-delete-${item.id}`,
      },
    ];

    return (
      <SwipeableRow leftActions={leftActions} rightActions={rightActions}>
        <ObservationCard
          item={item}
          index={index}
          accessibility={swipeA11yProps([...leftActions, ...rightActions])}
        />
      </SwipeableRow>
    );
  },
);

export default SwipeableObservationCard;
