import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import PlaceCard from "./PlaceCard";
import SwipeableRow, { SwipeAction, swipeA11yProps } from "../ui/SwipeableRow";
import { useTheme } from "../../store/theme-context";
import { useApiError } from "../../hooks/useApiError";
import { isValidationError } from "../../hooks/useMutationWithTranslation";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import { useDeletePlace, useUpdatePlace } from "../../hooks/Place/useOfflinePlace";
import { AppStackNavigationProp, PlaceItem } from "../../types";

// PlaceCard plus the actions of PlaceDetailScreen's header, one swipe away.
// The payloads are PlaceDetailScreen's own — keep the two in step. Errors:
// useUpdatePlace already toasts all but a validation error (see
// isValidationError), so onError reports only that one.
const SwipeablePlaceCard = memo(
  ({ item, index }: { item: PlaceItem; index: number }) => {
    const { t } = useTranslation();
    const { Colors } = useTheme();
    const navigation = useNavigation<AppStackNavigationProp>();
    const { showErrorToast } = useApiError();
    const updateMutation = useUpdatePlace(item.id);
    const deleteMutation = useDeletePlace();
    const confirmDelete = useConfirmDelete();

    const handleFavourite = () =>
      updateMutation.mutate(
        { favourite: !item.favourite },
        {
          onError: (e) => {
            if (isValidationError(e)) {
              showErrorToast(e, `SwipeablePlaceCard:toggleFavourite:${item.id}`);
            }
          },
        },
      );

    // Same as PlaceDetailScreen: leaving the list takes the reminder with it.
    const handleWantToVisit = () =>
      updateMutation.mutate(
        item.want_to_visit
          ? { want_to_visit: false, visit_reminder_at: null }
          : { want_to_visit: true },
        {
          onError: (e) => {
            if (isValidationError(e)) {
              showErrorToast(e, `SwipeablePlaceCard:toggleWantToVisit:${item.id}`);
            }
          },
        },
      );

    const handleDelete = () =>
      confirmDelete({
        message: t("delete_place_message"),
        runDelete: (callbacks) => deleteMutation.mutate(item.id, callbacks),
        tag: `SwipeablePlaceCard:deletePlace:${item.id}`,
      });

    const leftActions: SwipeAction[] = [
      {
        icon: item.favourite ? "star" : "star-outline",
        label: item.favourite
          ? t("remove_from_favourites")
          : t("add_to_favourites"),
        color: Colors.actionFavourite,
        onPress: handleFavourite,
        testID: `place-swipe-favourite-${item.id}`,
      },
      {
        icon: item.want_to_visit ? "flag" : "flag-outline",
        label: item.want_to_visit
          ? t("remove_from_want_to_visit")
          : t("add_to_want_to_visit"),
        color: Colors.actionWantToVisit,
        onPress: handleWantToVisit,
        testID: `place-swipe-want-to-visit-${item.id}`,
      },
    ];

    const rightActions: SwipeAction[] = [
      {
        icon: "create-outline",
        label: t("edit"),
        color: Colors.actionEdit,
        onPress: () => navigation.navigate("PlaceEditor", { place: item }),
        testID: `place-swipe-edit-${item.id}`,
      },
      {
        icon: "trash-outline",
        label: t("delete"),
        color: Colors.actionDelete,
        onPress: handleDelete,
        testID: `place-swipe-delete-${item.id}`,
      },
    ];

    return (
      <SwipeableRow leftActions={leftActions} rightActions={rightActions}>
        <PlaceCard
          item={item}
          index={index}
          accessibility={swipeA11yProps([...leftActions, ...rightActions])}
        />
      </SwipeableRow>
    );
  },
);

export default SwipeablePlaceCard;
