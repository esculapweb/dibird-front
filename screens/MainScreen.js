import { useState } from "react";
import { View, ScrollView } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../store/theme-context";
import FloatingNavbar from "../components/Main/FloatingNavbar";
import Stats from "../components/Main/Stats";
import Sparkline from "../components/Main/Sparkline";
import BirdOfTheDay from "../components/Main/BirdOfTheDay";
import Sections from "../components/Main/Sections";
import ChecklistHero from "../components/Main/ChecklistHero";
import QuickActions from "../components/Main/QuickActions";
import NewSpecies from "../components/Main/NewSpecies";

// ─────────────────────────────────────────────────────────────────────────────
const MainScreen = () => {
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const NAVBAR_HEIGHT = insets.top + 60;

  const [showDivider, setShowDivider] = useState(false);
  const onScroll = (e) => {
    const should = e.nativeEvent.contentOffset.y > 10;
    setShowDivider((prev) => (prev === should ? prev : should));
  };

  const dataSpark = [
    1, 2, 1, 3, 2, 1, 4, 2, 3, 5, 3, 2, 1, 3, 2, 4, 3, 2, 1, 2, 4, 2, 1, 3, 4,
    3, 2, 4, 3, 5,
  ];
  const dataStats = { species: 23, observations: 37, diaries: 10, rank: 1 };
  const dataChecklist = {
    country: "Беларусь",
    year: 2026,
    seen: 23,
    total: 347,
    newCount: 5,
    monthKey: "april",
  };
  const birdOfDay = {
    emoji: "🦅",
    nameKey: "bird_of_day_name",
    latin: "Haliaeetus albicilla",
    hintKey: "bird_of_day_hint",
  };
  const newSpecies = [
    {
      key: "sp1",
      emoji: "🦢",
      name: "Лебедь-кликун",
      latin: "Cygnus cygnus",
      date: "8 апр",
    },
    {
      key: "sp2",
      emoji: "🐦",
      name: "Авдотка",
      latin: "Burhinus oedicnemus",
      date: "7 апр",
    },
    {
      key: "sp3",
      emoji: "🕊️",
      name: "Белокрылая крачка",
      latin: "Chlidonias leucopterus",
      date: "4 апр",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Colors.backgroundMain }}>
      <FloatingNavbar showDivider={showDivider} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: NAVBAR_HEIGHT + 6,
          paddingBottom: insets.bottom + 16,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Stats data={dataStats} />
        <Sparkline data={dataSpark} />
        <BirdOfTheDay data={birdOfDay} />
        <ChecklistHero data={dataChecklist} />
        <NewSpecies data={newSpecies} />
        <QuickActions />
        <Sections data={dataStats} />
      </ScrollView>
    </View>
  );
};

export default MainScreen;
