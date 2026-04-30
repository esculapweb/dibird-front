import { useState, useCallback } from "react";
import { Share, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { fetchRatingCompareHeader, fetchRatingCompare } from "../util/fetches";
import ListScreen from "./ListScreen";
import Tabs from "../components/ui/Tabs";
import CompareProfileHeader from "../components/Profile/CompareProfileHeader";
import RatingCompareCard from "../components/Rating/RatingCompareCard";
import { useProfile } from "../store/profile-context";
import { buildShareUrl } from "../util/helpers";

const RatingsCompareScreen = ({ route }) => {
  const { t } = useTranslation();
  const { profile1, profile2 } = route.params;
  const [tabMode, setTabMode] = useState("all");
  const [currentFilters, setCurrentFilters] = useState({});
  const [currentSort, setCurrentSort] = useState(null);
  const { profile } = useProfile();

  const { data: headerData } = useQuery({
    queryKey: ["ratingCompareHeader", profile1, profile2, currentFilters],
    queryFn: () => fetchRatingCompareHeader(profile1, profile2, currentFilters),
    enabled: !!profile1 && !!profile2,
  });

  const renderItem = useCallback(
    ({ item, index }) => (
      <RatingCompareCard item={item} index={index} onPress={() => {}} />
    ),
    [headerData?.profile_data],
  );

  const handleShare = useCallback(async () => {
    if (!profile?.user) return;

    if (
      profile?.private &&
      [profile1, profile2].map(String).includes(String(profile?.user))
    ) {
      Toast.show({
        type: "info",
        text1: t("profile_private"),
        text2: t("profile_private_share_hint_rating"),
      });
      return;
    }

    const url = buildShareUrl(
      `users/compare/${profile1}/${profile2}/`,
      currentFilters,
      currentSort,
    );

    await Share.share(Platform.OS === "ios" ? { url } : { message: url });
  }, [profile, currentFilters, currentSort, profile1, profile2, t]);

  const noItems = {
    icon: "list-outline",
    message: t("no_observations_yet"),
  };

  const topEl = (
    <CompareProfileHeader
      profileData={headerData?.profile_data}
      counts={headerData?.counts}
    />
  );

  const tabOptions = [
    {
      value: "common",
      icon: "checkmark-circle",
      iconInactive: "checkmark-circle-outline",
      labelKey: t("common"),
      count: headerData?.counts?.common,
    },
    {
      value: "all",
      icon: "list",
      iconInactive: "list-outline",
      labelKey: t("all"),
      count: headerData?.counts?.all,
    },
    {
      value: "different",
      icon: "remove-circle",
      iconInactive: "remove-circle-outline",
      labelKey: t("different"),
      count: headerData?.counts?.different,
    },
  ];

  return (
    <ListScreen
      route={route}
      fetchFunction={fetchRatingCompare}
      getItemId={(item) => item.taxon_id}
      title={t("comparison")}
      errorTitle={t("comparison_unavailable")}
      extraFilters={{ profile1, profile2, tab: tabMode }}
      allowedFilters={["territory", "date", "species"]}
      renderItem={renderItem}
      noItems={noItems}
      onFiltersChange={setCurrentFilters}
      onSortChange={setCurrentSort}
      showHeaderBadge={false}
      handleSharePress={handleShare}
      listHeader={topEl}
      bottomEl={
        <Tabs
          tabOptions={tabOptions}
          tabsMode={tabMode}
          setTabsMode={setTabMode}
        />
      }
    />
  );
};

export default RatingsCompareScreen;
