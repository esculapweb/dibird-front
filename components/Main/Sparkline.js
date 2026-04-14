import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "../../store/theme-context";
import { fetchMyActivity } from "../../util/fetches";
import { formatMonthLabel } from "../../util/helpers";

const H_PAD = 16;
const SPARK_H = 52;

const Sparkline = ({ filters }) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const { data: activity } = useQuery({
    queryKey: ["Activity", filters],
    queryFn: () => fetchMyActivity(filters),
    enabled: !!filters,
  });

  const data = activity?.data ?? [];
  const meta = activity?.meta ?? {};
  const labels = activity?.labels ?? [];

  const INNER_W = width - H_PAD * 2 - 32;
  const barW = Math.max(
    Math.floor((INNER_W - (data.length || 1) * 2) / (data.length || 1)),
    3,
  );
  const max = data.length ? Math.max(...data) : 1;
  const RECENT = meta.recent_threshold ?? 0;
  const sparkDelta = meta.delta_label ?? "0";
  const periodLabelKey = meta.period_label_key ?? "activity_30d";
  const deltaLabelKey = meta.delta_label_key ?? "this_week";

  const periodLabelParams = {
    year: meta.year ?? meta.from?.slice(0, 4),
    date: labels[0],
    from: meta.from,
    to: meta.to,
    month: formatMonthLabel(labels[0]), // ← "март 2026" вместо "2026-03-16"
    months: meta.points,
    from_y: meta.from?.slice(0, 4),
    to_y: meta.to?.slice(0, 4),
  };

  if (!data.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.sparkHead}>
        <Text style={styles.sparkLabel}>
          {t(periodLabelKey, periodLabelParams)}
        </Text>
        <Text style={styles.sparkValue}>
          {sparkDelta} {t(deltaLabelKey, { n: meta.recent_window })}
        </Text>
      </View>

      <View style={styles.barsContainer}>
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
              style={[
                styles.bar,
                { width: barW, height: h, backgroundColor: bg },
              ]}
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
      borderRadius: 14,
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
    barsContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      height: SPARK_H,
      gap: 2,
    },
    bar: {
      borderRadius: 3,
    },
  });

// t("activity_today")
// t("activity_year")
// t("activity_single_day")
// t("activity_few_days")
// t("activity_month_range")
// t("activity_long_range")
// t("activity_multi_year")
// t("activity_30d")
// t("last_hours")
// t("this_week")
// t("this_month")
// t("this_quarter")
// t("this_quarter")
// t("last_quarter")
