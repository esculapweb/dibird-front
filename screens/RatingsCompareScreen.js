import { useState, useCallback } from "react";
import { View, Share } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { fetchRatingCompareHeader, fetchRatingCompare } from "../util/fetches";
import ListScreen from "./ListScreen";
import Tabs from "../components/ui/Tabs";
import CompareProfileHeader from "../components/Profile/CompareProfileHeader";
import RatingCompareCard from "../components/Rating/RatingCompareCard";
import { useProfile } from "../store/profile-context";
import { Config } from "../constants/config";

const RatingsCompareScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { profile1, profile2 } = route.params;
  const [tabMode, setTabMode] = useState("all");
  const [currentFilters, setCurrentFilters] = useState({});
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
    if (profile?.private) {
      Toast.show({
        type: "info",
        text1: t("profile_private"),
        text2: t("profile_private_share_hint"),
      });
      return;
    }

    // const params = new URLSearchParams(currentFilters).toString();
    // console.log('params', params)

    const url = `${Config.baseUrl}/my/users/compare/${profile1}/${profile2}/`;

    await Share.share({
      url: url,
      message: url,
    });
  }, [profile, currentFilters, profile1, profile2, t]);

  const noItems = {
    icon: "list-outline",
    message: t("no_observations_yet"),
  };

  return (
    <View style={{ flex: 1 }}>
      <CompareProfileHeader
        profileData={headerData?.profile_data}
        counts={headerData?.counts}
      />
      <ListScreen
        route={route}
        navigation={navigation}
        fetchFunction={fetchRatingCompare}
        getItemId={(item) => item.taxon_id}
        title={t("comparison")}
        errorTitle={t("comparison_unavailable")}
        extraFilters={{ profile1, profile2, tab: tabMode }}
        allowedFilters={["territory", "date", "species"]}
        renderItem={renderItem}
        noItems={noItems}
        onFiltersChange={setCurrentFilters}
        showHeaderBadge={false}
        handleSharePress={handleShare}
      />
      <Tabs
        tabOptions={[
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
        ]}
        tabsMode={tabMode}
        setTabsMode={setTabMode}
      />
    </View>
  );
};

export default RatingsCompareScreen;
