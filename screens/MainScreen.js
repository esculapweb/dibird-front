import { useState } from "react";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

import Layout from "../components/ui/Layout";

const MainScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const NAVBAR_HEIGHT = insets.top + 60;

  const [showDivider, setShowDivider] = useState(false);
  const onScroll = (e) => {
    const should = e.nativeEvent.contentOffset.y > 10;
    setShowDivider((prev) => (prev === should ? prev : should));
  };

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

  const dataStats = { species: 23, observations: 37, diaries: 10, rank: 1 };
  const dataChecklist = {
    country: "Беларусь",
    year: 2026,
    seen: 23,
    total: 347,
    newCount: 5,
    monthKey: "april",
  };

  return (
    <Layout>
      <FloatingNavbar
        showDivider={showDivider}
        onPress={() => setFilterModalVisible(true)}
        filters={filters}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: NAVBAR_HEIGHT,
          paddingBottom: insets.bottom,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Stats data={dataStats} filters={filters} />

        <Sparkline filters={filters} chartType="bar"  />

        <ChecklistHero data={dataChecklist} />

        <BirdOfTheDay filters={filters} />

        <NewSpecies filters={filters} filtersLoaded={filtersLoaded} />

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
