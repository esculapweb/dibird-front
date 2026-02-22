import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View, Pressable, Text } from "react-native";

import ListScreen from "./ListScreen";
import { fetchStat } from "../util/fetches";
import StatCard from "../components/Stats/StatCard";
import { useTheme } from "../store/theme-context";

const StatScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [seenMode, setSeenMode] = useState(true);

  const SORT_OPTIONS = [
    { label: t("taxonomic"), value: "ioc_id" },
    { label: t("taxonomic_desc"), value: "-ioc_id" },
    { label: t("alphabetic"), value: "name" },
    { label: t("alphabetic_desc"), value: "-name" },
    { label: t("date_sort_desc"), value: "-date_time" },
    { label: t("date_sort"), value: "date_time" },
  ];

  const handleAdd = () => navigation.navigate("ObservationEditor");

  const noItems = {
    icon: "stats-chart",
    message: t("no_stat_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  return (
    <>
      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentItem, seenMode && styles.activeSegment]}
          onPress={() => setSeenMode(true)}
        >
          <Text style={[styles.segmentText, seenMode && styles.activeText]}>
            Отмеченные
          </Text>
        </Pressable>

        <Pressable
          style={[styles.segmentItem, !seenMode && styles.activeSegment]}
          onPress={() => setSeenMode(false)}
        >
          <Text style={[styles.segmentText, !seenMode && styles.activeText]}>
            Не отмеченные
          </Text>
        </Pressable>
      </View>
      <ListScreen
        route={route}
        navigation={navigation}
        fetchFunction={(filters, sort, search, page) =>
          fetchStat(filters, sort, search, page, seenMode)
        }
        sortOptions={SORT_OPTIONS}
        allowedFilters={["territory", "place", "date"]}
        errorTitle={t("stat_unavailable")}
        ItemCard={StatCard}
        noItems={noItems}
        title={t("statistics")}
        seenMode={seenMode}
      />
    </>
  );
};

export default StatScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    segment: {
      flexDirection: "row",
      backgroundColor: Colors.card,
      borderRadius: 12,
      padding: 4,
      marginHorizontal: 16,
      marginTop: 8,
    },

    segmentItem: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 10,
    },

    activeSegment: {
      backgroundColor: Colors.primary,
    },

    segmentText: {
      fontSize: 14,
      color: Colors.textSecondary,
      fontWeight: "500",
    },

    activeText: {
      color: "white",
      fontWeight: "600",
    },
  });
