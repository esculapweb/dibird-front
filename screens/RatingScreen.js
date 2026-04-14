import { useCallback, useState } from "react";
import { Share, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import ListScreen from "./ListScreen";
import { fetchRating } from "../util/fetches";
import RatingCard from "../components/Rating/RatingCard";
import { useFilters } from "../store/filters-context";
import { useTheme } from "../store/theme-context";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import { useProfile } from "../store/profile-context";
import { buildShareUrl } from "../util/helpers";

const RatingScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { territory } = useFilters();
  const [currentFilters, setCurrentFilters] = useState(null);
  const [currentSort, setCurrentSort] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);
  const { profile } = useProfile();

  const handleToggle = useCallback((profileId) => {
    setSelectedIds((prev) => {
      const isSelected = prev.includes(profileId);
      if (isSelected) return prev.filter((id) => id !== profileId);

      if (prev.length >= 2) {
        Toast.show({
          type: "info",
          text1: t("selection_limit"),
          text2: t("you_can_only_compare_two_profiles"),
        });
        return prev;
      }

      return [...prev, profileId];
    });
  }, []);

  const handleAdd = useCallback(async () => {
    const defaultTerritory = currentFilters?.territory ?? territory ?? null;
    const defaultPlace = currentFilters?.place ?? null;
    const defaultSpecies = currentFilters?.species ?? null;
    navigation.navigate("ObservationEditor", {
      defaultTerritory,
      defaultPlace,
      defaultSpecies,
    });
  }, [navigation, currentFilters, territory]);

  const handleCompare = useCallback(() => {
    if (selectedIds.length < 2) return;
    const [profile1, profile2] = selectedIds;
    navigation.navigate("RatingsCompare", { profile1, profile2 });
  }, [selectedIds]);

  const handleShare = useCallback(async () => {
    const url = buildShareUrl("users/", currentFilters, currentSort);
    await Share.share(Platform.OS === "ios" ? { url } : { message: url });
  }, [currentFilters, currentSort]);

  const noItems = {
    icon: "trophy-outline",
    message: t("no_rating_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }) => (
    <RatingCard
      item={item}
      index={index}
      isSelected={selectedIds.includes(item.profile_id)}
      onToggle={() => handleToggle(item.profile_id)}
      profile={profile}
    />
  );

  const bottomEl =
    selectedIds.length == 2 ? (
      <FlatButtonBottom onPress={handleCompare} icon="people-outline">
        {t("compare_ratings")}
      </FlatButtonBottom>
    ) : (
      <FlatButtonBottom textColor={Colors.textSecondary}>
        {t("select_two_for_comparison")}
      </FlatButtonBottom>
    );

  return (
    <ListScreen
      route={route}
      navigation={navigation}
      fetchFunction={fetchRating}
      errorTitle={t("rating_unavailable")}
      allowedFilters={["territory", "date"]}
      onFiltersChange={setCurrentFilters}
      onSortChange={setCurrentSort}
      renderItem={renderItem}
      getItemId={(item) => item.profile_id}
      noItems={noItems}
      title={t("rating")}
      fabIcon="people-outline"
      handleSharePress={handleShare}
      bottomEl={bottomEl}
    />
  );
};

export default RatingScreen;
