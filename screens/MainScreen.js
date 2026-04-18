import { useState, useCallback } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDropdownQuery } from "../hooks/useDropdownQuery";
import { useQuery } from "@tanstack/react-query";

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
import {
  fetchStat,
  fetchMyCountries,
  fetchMyDashboardStat,
} from "../util/fetches";
import Layout from "../components/ui/Layout";
import { useLanguage } from "../store/language-context";
import { useList } from "../hooks/useList";

const MainScreen = ({ navigation, route }) => {
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const NAVBAR_HEIGHT = insets.top + 60;

  // const [showDivider, setShowDivider] = useState(false);
  // const onScroll = (e) => {
  //   const should = e.nativeEvent.contentOffset.y > 10;
  //   setShowDivider((prev) => (prev === should ? prev : should));
  // };

  const allowedFilters = ["territory", "date"];

  const {
    filters,
    filtersLoaded,
    filterModalVisible,
    setFilterModalVisible,
    handleFiltersApplied,
    handleClearFilters,
  } = useSyncedFilters({
    route,
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
  const country = countriesQuery.data?.filter(
    (item) => item.value === filters?.territory,
  )?.[0];

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

  const fetchStatSeen = useCallback((filters, sort, search, page) => {
    return fetchStat({ ...filters, seen: true }, sort, search, page);
  }, []);

  const { data: seenSpeciesData, isLoading: isLoadingSeenSpeciesData } =
    useList({
      screenName: "Stat",
      fetchFunction: fetchStatSeen,
      filters,
      tabsMode: "seen",
      sort: "-seen,-date_time",
      enabled: filtersLoaded,
    });

  return (
    <Layout>
      <FloatingNavbar
        // showDivider={showDivider}
        onPress={() => setFilterModalVisible(true)}
        filters={filters}
        country={country}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: NAVBAR_HEIGHT,
          paddingBottom: insets.bottom,
        }}
        // onScroll={onScroll}
        scrollEventThrottle={16}
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

        <BirdOfTheDay
          filters={filters}
          seenSpeciesData={seenSpeciesData}
          isLoadingSeenSpeciesData={isLoadingSeenSpeciesData}
        />

        <NewSpecies
          filters={filters}
          filtersLoaded={filtersLoaded}
          newSpeciesData={seenSpeciesData}
          isLoading={isLoadingSeenSpeciesData}
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
