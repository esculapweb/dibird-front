import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";

import FloatingNavbar from "../components/Main/FloatingNavbar";
import Stats from "../components/Main/Stats";
import Sparkline from "../components/Main/Sparkline";
import BirdOfTheDay from "../components/Main/BirdOfTheDay";
import ChecklistHero from "../components/Main/ChecklistHero";
import NewSpecies from "../components/Main/NewSpecies";
import QuickActions from "../components/Main/QuickActions";
import Sections from "../components/Main/Sections";
import FilterModal from "../components/Filters/FilterModal";
import { useSyncedFilters } from "../hooks/useSyncedFIlters";
import { useDropdownQuery } from "../hooks/useDropdownQuery";
import {
  fetchMyCountries,
  fetchMyDashboardStat,
} from "../util/fetches";
import Layout from "../components/ui/Layout";
import { useLanguage } from "../store/language-context";
import {
  FilterKey,
  AppStackNavigationProp,
  AppStackParamList,
} from "../types";

const MainScreen = () => {
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const NAVBAR_HEIGHT = insets.top + 60;

  const allowedFilters: FilterKey[] = ["territory", "date"];
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<RouteProp<AppStackParamList, "Main">>();

  const {
    filters,
    filtersLoaded,
    filterModalVisible,
    setFilterModalVisible,
    handleFiltersApplied,
    handleClearFilters,
  } = useSyncedFilters({
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



  return (
    <Layout>
      <FloatingNavbar
        onPress={() => setFilterModalVisible(true)}
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

        <BirdOfTheDay filters={filters} />

        <NewSpecies
          filters={filters}
          filtersLoaded={filtersLoaded}
        />

        <QuickActions filters={filters} />

        <Sections data={dataStats} />
      </ScrollView>
      <FilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        allowed={allowedFilters}
        setFilters={handleFiltersApplied}
        clearFilters={handleClearFilters}
      />
    </Layout>
  );
};

export default MainScreen;
