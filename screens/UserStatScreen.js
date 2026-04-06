import { useState, useCallback } from "react";
import { View, Text, StyleSheet, Share } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import ListScreen from "./ListScreen";
import { fetchStat, fetchUserProfile } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import Tabs from "../components/ui/Tabs";
import { useFilters } from "../store/filters-context";
import { useTheme } from "../store/theme-context";
import ProfileAvatar from "../components/Profile/ProfileAvatar";
import { useProfileDisplay } from "../hooks/Profile/useProfileDisplay";
import { buildShareUrl } from "../util/helpers";

const UserStatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { profileId } = route.params;
  const { seenMode, setSeenMode } = useFilters();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [currentFilters, setCurrentFilters] = useState(null);
  const [currentSort, setCurrentSort] = useState(null); 

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", profileId],
    queryFn: () => fetchUserProfile(profileId),
    enabled: !!profileId,
  });

  const firstName = userProfile?.user_data_public.first_name;
  const lastName = userProfile?.user_data_public.last_name;
  const username = userProfile?.user_data_public.username ?? "";
  const { fullName } = useProfileDisplay({ firstName, lastName, username });

  const [noItems, setNoItems] = useState({
    icon: "stats-chart",
    message: t("no_stat_yet"),
    actions: [],
  });

  const fetchData = useCallback(
    (filters, sort, search, page, openFilterModal) => {
      const safeFilters = { ...filters };

      if (!safeFilters.territory && seenMode !== "seen") {
        setNoItems({
          icon: "stats-chart",
          message: t("select_territory_to_view_not_seen"),
          actions: [{ label: t("select_territory"), onPress: openFilterModal }],
        });
        return Promise.resolve({ results: [], pagination: { count: 0 } });
      }

      safeFilters.seen =
        seenMode === "seen" ? true : seenMode === "unseen" ? false : null;

      return fetchStat(safeFilters, sort, search, page);
    },
    [seenMode, t],
  );

  const handleShare = useCallback(async () => {
      const url = buildShareUrl(`/users/stat/${profileId}`, currentFilters, currentSort);
      await Share.share({
        url: url,
        message: url,
      });
    }, [profileId, currentFilters, currentSort]);

  const renderItem = useCallback(
    ({ item, index }) => (
      <StatCard
        item={item}
        index={index}
        seenMode={seenMode}
        onPress={() => {}}
      />
    ),
    [seenMode],
  );

  return (
    <View style={styles.container}>
      {userProfile && (
        <View style={styles.profileHeader}>
          <ProfileAvatar
            avatar={userProfile.avatar}
            firstName={firstName}
            lastName={lastName}
            username={username}
            size={44}
          />
          <Text style={styles.fullName}>{fullName}</Text>
        </View>
      )}
      <ListScreen
        route={route}
        navigation={navigation}
        fetchFunction={fetchData}
        title={t("statistics")}
        errorTitle={t("stat_unavailable")}
        renderItem={renderItem}
        noItems={noItems}
        tabsMode={seenMode}
        getItemId={(item) => item.species_id}
        allowSort={true}
        extraFilters={{ user_id: profileId }}
        allowedFilters={["territory", "species", "date"]}
        onFiltersChange={setCurrentFilters}
        onSortChange={setCurrentSort}
        handleSharePress={handleShare}
      />
      <Tabs
        tabOptions={[
          {
            value: "seen",
            icon: "eye",
            iconInactive: "eye-outline",
            labelKey: t("seen"),
          },
          {
            value: "all",
            icon: "apps",
            iconInactive: "apps-outline",
            labelKey: t("all"),
          },
          {
            value: "unseen",
            icon: "eye-off",
            iconInactive: "eye-off-outline",
            labelKey: t("not_seen"),
          },
        ]}
        tabsMode={seenMode}
        setTabsMode={setSeenMode}
      />
    </View>
  );
};

export default UserStatScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
      backgroundColor: Colors.backgroundMain,
      gap: 12,
    },
    fullName: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
    },
  });
