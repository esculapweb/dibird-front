import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "../../store/theme-context";
import StatCard from "../ui/StatCard";

const H_PAD = 16;

const Stats = ({ data, filters }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation();

  return (
    <View style={styles.statsRow}>
      <StatCard
        value={data.species}
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

const stylesFn = (Colors) =>
  StyleSheet.create({
    statsRow: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: H_PAD,
      paddingBottom: 12,
    },
  });
