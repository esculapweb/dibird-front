import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import StatCard from "../ui/StatCard";
import StatsSkeleton from "./StatsSkeleton";
import { AppStackNavigationProp, Filters, DashboardStat } from "../../types";

const H_PAD = 16;

const Stats = ({
  data,
  filters,
  isLoading,
}: {
  data?: DashboardStat;
  filters: Filters;
  isLoading: boolean;
}) => {
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();

  if (isLoading) return <StatsSkeleton />;
  if (!data) return null;

  return (
    <View style={styles.statsRow}>
      <StatCard
        value={data.seen}
        label={t("species")}
        onPress={() =>
          navigation.navigate("Stat", {
            filtersOverride: {
              ...filters,
            },
            seenMode: "seen",
            o: "-seen,-date_time",
          })
        }
      />
      <StatCard
        value={data.observations}
        label={t("observations")}
        onPress={() => navigation.navigate("Observations")}
      />
      <StatCard
        value={data.diaries}
        label={t("diaries")}
        onPress={() => navigation.navigate("Diaries")}
      />
      <StatCard
        value={`#${data.rank}`}
        label={t("rating")}
        onPress={() => navigation.navigate("Rating")}
      />
    </View>
  );
};

export default Stats;

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: H_PAD,
    paddingBottom: 12,
  },
});
