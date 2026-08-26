import { useState, useCallback } from "react";
import { Share, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useRoute } from "@react-navigation/native";

import { fetchRatingCompareHeader, fetchRatingCompare } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import ListScreen from "./ListScreen";
import Tabs from "../components/ui/Tabs";
import CompareProfileHeader from "../components/Profile/CompareProfileHeader";
import RatingCompareCard from "../components/Rating/RatingCompareCard";
import { useProfile } from "../store/profile-context";
import { buildShareUrl } from "../util/helpers";
import { useOpenSpecies } from "../hooks/useOpenSpecies";
import { track } from "../services/analytics";
import {
  AppStackRouteProp,
  compareMode,
  Filters,
  RatingCompareItem,
  seenMode,
} from "../types";

const RatingsCompareScreen = () => {
  const { t } = useTranslation();
  const openSpecies = useOpenSpecies();
  const route = useRoute<AppStackRouteProp<"RatingsCompare">>();
  const { profile1, profile2 } = route.params;
  const [tabMode, setTabMode] = useState<seenMode | compareMode>("all");
  const [currentFilters, setCurrentFilters] = useState<Filters | null>(null);
  const [currentSort, setCurrentSort] = useState<string | null>(null);
  const { profile } = useProfile();

  const { data: headerData } = useQuery({
    queryKey: ["ratingCompareHeader", profile1, profile2, currentFilters],
    queryFn: () => fetchRatingCompareHeader(profile1, profile2, currentFilters),
    enabled: !!profile1 && !!profile2,
    staleTime: StaleTime.FIVE_MINUTES,
  });

  const renderItem = useCallback(
    ({ item, index }: { item: RatingCompareItem; index: number }) => (
      <RatingCompareCard
        item={item}
        index={index}
        onPress={() => openSpecies(item.segment, "rating_compare")}
      />
    ),
    [headerData?.profile_data, openSpecies],
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

    track("share_tapped", { type: "rating_compare" });
    await Share.share(Platform.OS === "ios" ? { url } : { message: url });
  }, [profile, currentFilters, currentSort, profile1, profile2, t]);

  const noItems = {
    icon: "list-outline" as const,
    message: t("no_observations_yet"),
  };

  const topEl = (
    <CompareProfileHeader
      myProfileId={profile?.user}
      profileData={headerData?.profile_data}
      counts={headerData?.counts}
    />
  );

  const tabOptions = [
    {
      value: "common" as const,
      icon: "checkmark-circle" as const,
      iconInactive: "checkmark-circle-outline" as const,
      labelKey: t("common"),
      count: headerData?.counts?.common,
    },
    {
      value: "all" as const,
      icon: "list" as const,
      iconInactive: "list-outline" as const,
      labelKey: t("all"),
      count: headerData?.counts?.all,
    },
    {
      value: "different" as const,
      icon: "remove-circle" as const,
      iconInactive: "remove-circle-outline" as const,
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
      onFiltersChange={async (val) => setCurrentFilters(val)}
      onSortChange={async (val) => setCurrentSort(val)}
      showHeaderBadge={false}
      handleSharePress={handleShare}
      listHeader={topEl}
      bottomEl={
        <Tabs
          tabOptions={tabOptions}
          tabsMode={tabMode}
          setTabsMode={(val) => setTabMode(val)}
        />
      }
    />
  );
};

export default RatingsCompareScreen;
