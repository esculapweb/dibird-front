import { useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Share, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "@react-navigation/native";

import ListScreen from "./ListScreen";
import { fetchStat, fetchUserProfile } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import StatCard from "../components/Stats/StatCard";
import Tabs from "../components/ui/Tabs";
import { useFilters } from "../store/filters-context";
import { useTheme, ThemeColors } from "../store/theme-context";
import ProfileAvatar from "../components/Profile/ProfileAvatar";
import { useProfileDisplay } from "../hooks/Profile/useProfileDisplay";
import { buildShareUrl, speciesDetails } from "../util/helpers";
import { track } from "../services/analytics";
import {
  AppStackRouteProp,
  emptyPaginatedResponse,
  EmptyStateProps,
  Filters,
  PaginatedResponse,
  seenMode,
  SpeciesItem,
  StatPaginatedResponse,
} from "../types";

const UserStatScreen = () => {
  const { t } = useTranslation();
  const route = useRoute<AppStackRouteProp<"UserStat">>();
  const { profileId } = route.params;
  const { seenMode, setSeenMode } = useFilters();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [currentFilters, setCurrentFilters] = useState<Filters | null>(null);
  const [currentSort, setCurrentSort] = useState<string | null>(null);
  const openFilterModalRef = useRef<(() => void) | null>(null);

  const [speciesCounts, setSpeciesCounts] = useState<{
    seen: number;
    total: number;
  } | null>(null);

  const handleFirstPageData = useCallback(
    (page: StatPaginatedResponse<SpeciesItem>) => {
      const total =
        typeof page.total_species === "number" ? page.total_species : 0;
      const seen =
        typeof page.seen_species === "number" ? page.seen_species : 0;
      setSpeciesCounts({ seen, total });
    },
    [],
  );

  const { data: userProfile } = useQuery({
    queryKey: ["userProfile", profileId],
    queryFn: () => fetchUserProfile(profileId),
    enabled: !!profileId,
    staleTime: StaleTime.TEN_MINUTES,
  });

  const firstName = userProfile?.user_data_public.first_name;
  const lastName = userProfile?.user_data_public.last_name;
  const username = userProfile?.user_data_public.username ?? "";
  const { fullName } = useProfileDisplay({ firstName, lastName, username });

  const [noItems, setNoItems] = useState<EmptyStateProps>({
    icon: "stats-chart" as const,
    message: t("no_stat_yet"),
    actions: [],
  });

  const fetchData = useCallback(
    (filters: Filters, sort: string | null, search: string, page: number) => {
      const safeFilters = { ...filters };

      if (!safeFilters.territory && seenMode !== "seen") {
        return Promise.resolve<PaginatedResponse<SpeciesItem>>(
          emptyPaginatedResponse(),
        );
      }

      safeFilters.seen =
        seenMode === "seen" ? true : seenMode === "unseen" ? false : null;

      return fetchStat(safeFilters, sort, search, page);
    },
    [seenMode, t],
  );

  const handleShare = useCallback(async () => {
    const url = buildShareUrl(
      `users/stat/${profileId}`,
      currentFilters,
      currentSort,
    );
    track("share_tapped", { type: "user_stat" });
    await Share.share(Platform.OS === "ios" ? { url } : { message: url });
  }, [profileId, currentFilters, currentSort]);

  const customHeaderBadge = useCallback(
    (res: StatPaginatedResponse<SpeciesItem>): number | string | undefined => {
      if (
        typeof res?.seen_species !== "number" ||
        typeof res?.total_species !== "number"
      ) {
        return undefined;
      }
      return `${res.seen_species} / ${res.total_species}`;
    },
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: SpeciesItem; index: number }) => (
      <StatCard
        item={item}
        index={index}
        seenMode={seenMode}
        onPress={() => speciesDetails(item.segment)}
      />
    ),
    [seenMode],
  );

  const tabOptions = [
    {
      value: "seen" as const,
      icon: "eye" as const,
      iconInactive: "eye-outline" as const,
      labelKey: t("seen"),
      count: speciesCounts?.seen ?? undefined,
    },
    {
      value: "all" as const,
      icon: "apps" as const,
      iconInactive: "apps-outline" as const,
      labelKey: t("all"),
      count: speciesCounts?.total ?? undefined,
    },
    {
      value: "unseen" as const,
      icon: "eye-off" as const,
      iconInactive: "eye-off-outline" as const,
      labelKey: t("not_seen"),
      count:
        speciesCounts !== null
          ? speciesCounts.total - speciesCounts.seen
          : undefined,
    },
  ];

  const topEl = userProfile && (
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
  );

  return (
    <ListScreen
      route={route}
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
      onOpenFilterModal={(fn) => {
        openFilterModalRef.current = fn;
      }}
      onFiltersChange={async (val) => {
        if (!val?.territory && seenMode !== "seen") {
          setNoItems({
            icon: "stats-chart" as const,
            message: t("select_territory_to_view_not_seen"),
            actions: [
              {
                label: t("select_territory"),
                onPress: () => openFilterModalRef.current?.(),
              },
            ],
          });
        }
        setCurrentFilters(val);
      }}
      onSortChange={async (val) => setCurrentSort(val)}
      handleSharePress={handleShare}
      customHeaderBadge={customHeaderBadge}
      onFirstPageData={handleFirstPageData}
      topEl={topEl}
      bottomEl={
        <Tabs
          tabOptions={tabOptions}
          tabsMode={seenMode}
          setTabsMode={(val) => setSeenMode(val as seenMode)}
        />
      }
    />
  );
};

export default UserStatScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
      gap: 12,
    },
    fullName: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
    },
  });
