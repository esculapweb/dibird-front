import { useState, useCallback } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { fetchRatingCompareHeader, fetchRatingCompare } from "../util/fetches";
import ListScreen from "./ListScreen";
import Tabs from "../components/ui/Tabs";
import CompareProfileHeader from "../components/Profile/CompareProfileHeader";
import RatingCompareCard from "../components/Rating/RatingCompareCard";

const RatingsCompareScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { profile1, profile2 } = route.params;
  const [tabMode, setTabMode] = useState("all");
  const [currentFilters, setCurrentFilters] = useState({});

  const { data: headerData } = useQuery({
    queryKey: ["ratingCompareHeader", profile1, profile2, currentFilters],
    queryFn: () => fetchRatingCompareHeader(profile1, profile2, currentFilters),
    enabled: !!profile1 && !!profile2,
  });

  const renderItem = useCallback(
    ({ item, index }) => (
      <RatingCompareCard item={item} index={index} onPress={()=>{}} />
    ),
    [headerData?.profile_data],
  );

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
        getItemId = {(item) => item.taxon_id}
        title={t("comparison")}
        errorTitle={t("comparison_unavailable")}
        extraFilters={{ profile1, profile2, tab: tabMode }}
        allowedFilters={["territory", "date", "species"]}
        renderItem={renderItem}
        noItems={noItems}
        onFiltersChange={setCurrentFilters}
        showHeaderBadge={false}
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
