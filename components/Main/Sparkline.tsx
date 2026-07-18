import { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { fetchMyActivity } from "../../util/fetches";
import { StaleTime } from "../../constants/staleTime";
import { SparklineSkeleton } from "./SparklineSkeleton";
import { ActivityResponse, Filters } from "../../types";
import { useContentWidth } from "../../hooks/useContentWidth";

const H_PAD = 16;
const SPARK_H = 52;

const Sparkline = ({
  filters,
  chartType = "bar",
}: {
  filters: Filters;
  chartType?: "bar" | "dot";
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("newSpecies");

  const { t } = useTranslation();
  const width = useContentWidth();
  const { Colors } = useTheme();

  const mainColor = Colors.main100;
  const mutedColor = Colors.main300;
  const styles = stylesFn(Colors, mainColor, mutedColor);

  const { data: activity, isLoading } = useQuery({
    queryKey: [
      "Activity",
      filters?.territory ?? null,
      filters?.date?.type ?? null,
      filters?.date?.year ?? null,
      filters?.date?.from ?? null,
      filters?.date?.to ?? null,
      mode,
    ],
    queryFn: () =>
      fetchMyActivity({
        ...filters,
        ...(mode === "newSpecies" && { new: true }),
      }),

    enabled: !!filters,
    staleTime: StaleTime.FIVE_MINUTES,
  });

  const data = activity?.data ?? [];
  const meta = activity?.meta ?? ({} as ActivityResponse["meta"]);

  const INNER_W = width - H_PAD * 2 - 32;
  const barW = Math.max(
    Math.floor((INNER_W - (data.length || 1) * 2) / (data.length || 1)),
    3,
  );
  const max = data.length ? Math.max(...data) : 1;
  const RECENT = meta.recent_threshold ?? 0;
  const sparkDelta = meta.delta_label ?? "0";
  const deltaLabelKey = meta.delta_label_key ?? "this_week";

  const OPTIONS = [
    { key: "newSpecies", label: t("new_species") },
    { key: "observations", label: t("observations") },
  ];

  const BarItem = ({ h, mb, bg }: { h: number; mb: number; bg: string }) =>
    chartType === "dot" ? (
      <View
        style={{
          width: barW,
          height: SPARK_H,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: barW,
            height: barW,
            borderRadius: barW / 2,
            backgroundColor: bg,
            marginBottom: mb,
          }}
        />
      </View>
    ) : (
      <View
        style={[styles.bar, { width: barW, height: h, backgroundColor: bg }]}
      />
    );
  const allZero = data.every((v) => v === 0);
  if (isLoading) return <SparklineSkeleton />;
  if (!data.length || allZero) return null;

  return (
    <View style={styles.card}>
      <View style={styles.sparkHead}>
        <View style={styles.dropdownWrapper}>
          <Pressable
            onPress={() => setIsOpen((v) => !v)}
            style={styles.dropdownTrigger}
            hitSlop={10}
          >
            <Text style={styles.dropdownText}>
              {mode === "newSpecies" ? t("new_species") : t("observations")}
            </Text>
            <Ionicons
              name={isOpen ? "chevron-up" : "chevron-down"}
              size={14}
              color={Colors.textSecondary}
              style={{ marginTop: 1 }}
            />
          </Pressable>

          {isOpen && (
            <View style={styles.dropdownMenu}>
              {OPTIONS.map((opt) => {
                const active = mode === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      setMode(opt.key);
                      setIsOpen(false);
                    }}
                    style={[
                      styles.dropdownItem,
                      active && styles.dropdownItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        active && styles.dropdownItemTextActive,
                      ]}
                    >
                      {t(opt.label)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {meta.delta !== 0 && (
          <Text style={styles.sparkValue}>
            {sparkDelta} {t(deltaLabelKey, { n: meta.recent_window })}
          </Text>
        )}
      </View>

      <View style={styles.barsContainer}>
        {data.map((v, i) => {
          const h = Math.max(Math.round((v / max) * SPARK_H), 4);
          const mb = Math.max(Math.round((v / max) * (SPARK_H - barW)), 0);
          const isRecent = i >= RECENT;
          const isTall = v >= max * 0.75;
          const bg = isRecent ? mainColor : isTall ? mutedColor : Colors.border;
          return <BarItem key={i} h={h} mb={mb} bg={bg} />;
        })}
      </View>
    </View>
  );
};

export default Sparkline;

const stylesFn = (Colors: ThemeColors, mainColor: string, mutedColor: string) =>
  StyleSheet.create({
    card: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      padding: 16,
      overflow: "visible",
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
      color: mainColor,
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

    dropdownWrapper: {
      position: "relative",
    },

    dropdownTrigger: {
      flexDirection: "row",
      alignItems: "center",
    },

    dropdownText: {
      fontSize: 13,
      lineHeight: 16,
      color: Colors.textSecondary,
      marginRight: 4,
    },

    chevron: {
      fontSize: 12,
      color: Colors.textSecondary,
    },

    dropdownMenu: {
      position: "absolute",
      top: 26,
      left: 0,
      minWidth: 120,
      backgroundColor: Colors.primary100,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingVertical: 6,
      zIndex: 10,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },

    dropdownItem: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },

    dropdownItemActive: {
      backgroundColor: mutedColor,
    },

    dropdownItemText: {
      fontSize: 13,
      color: Colors.textSecondary,
    },

    dropdownItemTextActive: {
      color: mainColor,
    },
  });

// t("activity_today")
// t("activity_year")
// t("activity_single_day")
// t("activity_few_days")
// t("activity_month_range")
// t("activity_long_range")
// t("activity_very_long_range")
// t("activity_multi_year")
// t("activity_30d")
// t("last_hours")
// t("this_week")
// t("this_month")
// t("this_year_")
// t("last_month")
// t("this_quarter")
// t("last_quarter")
// t("today_vs_yesterday")
// t("last_day")
// t("last_week")
// t("last_year")
