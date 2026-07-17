import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
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
import FilterSheetContent from "../components/Filters/FilterSheetContent";
import { useSyncedFilters } from "../hooks/useSyncedFilters";
import { useDropdownQuery } from "../hooks/useDropdownQuery";
import { fetchMyCountries, fetchMyDashboardStat } from "../util/fetches";
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

  const { data: dataStats, isLoading: isLoadingDataStat } = useQuery({
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
  });

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
      >
        <Stats
          data={dataStats}
          filters={filters}
          isLoading={isLoadingDataStat}
        />

        <Sparkline filters={filters} chartType="bar" />

        <ChecklistHero
          data={dataStats}
          country={country}
          filters={filters}
          isLoading={isLoadingDataStat}
        />

        <RareNearby filters={filters} />

        <BirdOfTheDay filters={filters} />

        <NewSpecies filters={filters} filtersLoaded={filtersLoaded} />

        <QuickActions filters={filters} />

        <Sections />
      </ScrollView>
    </Layout>
  );
};

export default MainScreen;
