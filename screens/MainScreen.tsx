import { useCallback, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";

import FloatingNavbar from "../components/Main/FloatingNavbar";
import Stats from "../components/Main/Stats";
import Sparkline from "../components/Main/Sparkline";
import BirdOfTheDay from "../components/Main/BirdOfTheDay";
import ChecklistHero from "../components/Main/ChecklistHero";
import RareNearby from "../components/Main/RareNearby";
import NewSpecies from "../components/Main/NewSpecies";
import QuickActions from "../components/Main/QuickActions";
import Sections from "../components/Main/Sections";
import CatalogCard from "../components/Main/CatalogCard";
import WelcomeCard from "../components/Main/WelcomeCard";
import WidgetError from "../components/Main/WidgetError";
import FilterSheetContent from "../components/Filters/FilterSheetContent";
import { useSyncedFilters } from "../hooks/useSyncedFilters";
import { useDropdownQuery } from "../hooks/useDropdownQuery";
import { fetchMyCountries, fetchMyDashboardStat } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import Layout from "../components/ui/Layout";
import { useLanguage } from "../store/language-context";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  AllowedFilterKey,
} from "../types";
import { BottomSheet } from "../services/bottomSheet";
import { useTranslation } from "react-i18next";

const MainScreen = () => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const NAVBAR_HEIGHT = insets.top + 60;

  const allowedFilters: AllowedFilterKey[] = ["territory", "date"];
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Main">>();

  const { filters, filtersLoaded, handleFiltersApplied, handleClearFilters } =
    useSyncedFilters({
      route: route,
      navigation,
      screenName: "Main",
      allowSort: false,
      allowedFilters,
    });

  const { query: countriesQuery } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
    enabled: filtersLoaded,
  });
  const country = countriesQuery.data?.find(
    (item) => item.value === filters?.territory,
  );

  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // The dashboard is a dozen widgets, each with its own query — refetching
  // whatever is currently mounted is both simpler and more complete than
  // threading a refetch through every one of them.
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  const {
    data: dataStats,
    isLoading: isLoadingDataStat,
    isError: isDataStatError,
    refetch: refetchDataStat,
  } = useQuery({
    queryKey: [
      "DashboardStat",
      filters?.territory ?? null,
      filters?.date?.type ?? null,
      filters?.date?.year ?? null,
      filters?.date?.from ?? null,
      filters?.date?.to ?? null,
    ],
    queryFn: () => fetchMyDashboardStat(filters),
    enabled: filtersLoaded,
    staleTime: StaleTime.TEN_MINUTES,
  });

  // Nothing logged yet: every content widget below hides itself, so without
  // this the screen would be zeros and an icon grid.
  const isNewUser =
    !!dataStats && dataStats.observations === 0 && dataStats.diaries === 0;

  const openFilters = () => {
    BottomSheet.showContent({
      title: t("filters"),
      onReset: handleClearFilters,
      renderContent: (dismiss: () => void) => (
        <FilterSheetContent
          filters={filters}
          allowed={allowedFilters}
          setFilters={handleFiltersApplied}
          dismiss={dismiss}
        />
      ),
    });
  };

  return (
    <Layout>
      <FloatingNavbar
        onPress={openFilters}
        filters={filters}
        country={country}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: NAVBAR_HEIGHT + 8,
          paddingBottom: insets.bottom,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            // Clear of the floating navbar (which is NAVBAR_HEIGHT + 20
            // tall), otherwise the spinner comes up under its gradient.
            progressViewOffset={NAVBAR_HEIGHT + 20}
          />
        }
      >
        {isDataStatError && !dataStats ? (
          // Stats and the checklist hero share this one query, so one line
          // covers both rather than two blocks vanishing without a word.
          <WidgetError
            onRetry={refetchDataStat}
            testID="dashboard-stat-error"
          />
        ) : (
          <Stats
            data={dataStats}
            filters={filters}
            isLoading={isLoadingDataStat}
          />
        )}

        {/* Logging a sighting is what the app is for — it shouldn't sit
            below five content blocks. */}
        <QuickActions filters={filters} />

        {isNewUser && <WelcomeCard />}

        <Sparkline filters={filters} chartType="bar" />

        <ChecklistHero
          data={dataStats}
          country={country}
          filters={filters}
          isLoading={isLoadingDataStat}
        />

        <RareNearby filters={filters} />

        <BirdOfTheDay filters={filters} />

        <CatalogCard />

        <NewSpecies filters={filters} filtersLoaded={filtersLoaded} />

        <Sections />
      </ScrollView>
    </Layout>
  );
};

export default MainScreen;
