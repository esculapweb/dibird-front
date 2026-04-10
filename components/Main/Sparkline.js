import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";

const H_PAD = 16;
const SPARK_H = 52;

const Sparkline = ({ data }) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const INNER_W = width - H_PAD * 2 - 32;
  const barW = Math.max(
    Math.floor((INNER_W - data.length * 2) / data.length),
    3,
  );
  const max = Math.max(...data);
  const RECENT = data.length - 7;
  const sparkWeekDelta = "+5";

  return (
    <View style={styles.card}>
      <View style={styles.sparkHead}>
        <Text style={styles.sparkLabel}>
          {t("activity_30d") ?? "Активность · 30 дней"}
        </Text>
        <Text style={styles.sparkValue}>
          {sparkWeekDelta} {t("this_week") ?? "эта неделя"}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height: SPARK_H,
          gap: 2,
        }}
      >
        {data.map((v, i) => {
          const h = Math.max(Math.round((v / max) * SPARK_H), 4);
          const isRecent = i >= RECENT;
          const isTall = v >= max * 0.75;
          const bg = isRecent
            ? Colors.main100
            : isTall
              ? Colors.main300
              : Colors.border;
          return (
            <View
              key={i}
              style={{
                width: barW,
                height: h,
                borderRadius: 3,
                backgroundColor: bg,
              }}
            />
          );
        })}
      </View>
    </View>
  );
};

export default Sparkline;

const stylesFn = (Colors) =>
  StyleSheet.create({
    card: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      backgroundColor: Colors.primary100,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: Colors.border,
      padding: 16,
    },
    sparkHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sparkLabel: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    sparkValue: {
      fontSize: 13,
      fontWeight: "500",
      color: Colors.main100,
    },
  });
