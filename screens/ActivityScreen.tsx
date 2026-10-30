import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import Layout from "../components/ui/Layout";
import ViewSwitch from "../components/ui/ViewSwitch";
import WidgetError from "../components/Main/WidgetError";
import ActivityChart from "../components/Activity/ActivityChart";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useActivity } from "../hooks/useActivity";
import { useContentWidth } from "../hooks/useContentWidth";
import {
  deltaWindowLabel,
  formatPeriodLabel,
  periodRange,
  topPeriodIndexes,
} from "../util/activityPeriods";
import {
  ActivityMode,
  ActivityResponse,
  AppStackNavigationProp,
  AppStackRouteProp,
  Filters,
} from "../types";

const H_PAD = 16;
const CARD_PAD = 16;

const formatRangeDay = (iso: string, language: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const ActivityScreen = () => {
  const { t, i18n } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const width = useContentWidth();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"Activity">>();
  const filters = route.params.filters;

  const [mode, setMode] = useState<ActivityMode>(route.params.mode);
  const [selected, setSelected] = useState<number | null>(null);

  const { data: activity, isLoading, isError, refetch } = useActivity(
    filters,
    mode,
  );

  const data = activity?.data ?? [];
  const meta = activity?.meta ?? ({} as Partial<ActivityResponse["meta"]>);
  // Without matching period starts (an older backend, or an offline cache
  // entry written before the field existed) the bars can still be drawn, but
  // there is nothing to label them with or to open.
  const periods =
    activity?.periods?.length === data.length ? activity.periods : null;
  const group = meta.group ?? "day";
  const lastDay = meta.to ?? "";

  // A new response (mode switch, refetch) resets the selection to the latest
  // column: an index into the previous series would point at another period.
  useEffect(() => {
    setSelected(data.length ? data.length - 1 : null);
  }, [activity]);

  const openPeriod = (index: number) => {
    if (!periods) return;
    const { from, to } = periodRange(periods, index, group, lastDay);
    const base: Filters = {
      territory: filters?.territory ?? null,
      place: null,
      species: null,
    };
    if (mode === "newSpecies") {
      // The chart's period stays the date filter: "new" means first seen
      // within it, and first_seen narrows the list down to this column. A
      // date filter of the column alone would list every species merely
      // seen in it, more than the column counts.
      navigation.navigate("Stat", {
        filtersOverride: {
          ...base,
          date: filters?.date ?? null,
          first_seen: { from, to },
        },
        seenMode: "seen",
        o: "-seen,-date_time",
      });
    } else {
      navigation.navigate("Observations", {
        filtersOverride: { ...base, date: { type: "range", from, to } },
      });
    }
  };

  const countLabel = (count: number) =>
    mode === "newSpecies"
      ? t("activity_new_species_count", { count })
      : t("activity_observations_count", { count });

  const deltaLabel = deltaWindowLabel(t, meta);
  const chartWidth = width - H_PAD * 2 - CARD_PAD * 2;
  const allZero = data.every((v) => v === 0);
  const top = periods ? topPeriodIndexes(data) : [];

  const renderBody = () => {
    if (isLoading)
      return (
        <ActivityIndicator
          style={styles.loader}
          color={Colors.main100}
          testID="activity-loading"
        />
      );
    if (isError && !data.length)
      return <WidgetError onRetry={refetch} testID="activity-error" />;
    if (!data.length || allZero)
      return (
        <Text style={styles.empty} testID="activity-empty">
          {t("activity_empty")}
        </Text>
      );

    return (
      <>
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiValue} testID="activity-total">
              {meta.total ?? 0}
            </Text>
            <Text style={styles.kpiLabel}>{t("activity_total")}</Text>
          </View>
          {!!deltaLabel && (
            <View style={styles.kpi}>
              <Text style={styles.kpiValue} testID="activity-delta">
                {meta.delta_label ?? "0"}
              </Text>
              <Text style={styles.kpiLabel}>{deltaLabel}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <ActivityChart
            data={data}
            periods={periods ?? []}
            group={group}
            width={chartWidth}
            selected={periods ? selected : null}
            onSelect={setSelected}
          />

          {periods && selected !== null && selected < data.length && (
            <Pressable
              style={styles.selected}
              onPress={() => openPeriod(selected)}
              testID="activity-selected"
            >
              <View style={styles.flex}>
                <Text style={styles.selectedPeriod}>
                  {formatPeriodLabel(periods, selected, group, lastDay)}
                </Text>
                <Text style={styles.selectedValue}>
                  {countLabel(data[selected])}
                </Text>
              </View>
              {data[selected] > 0 && (
                <View style={styles.openRow}>
                  <Text style={styles.openText}>
                    {mode === "newSpecies"
                      ? t("activity_show_species")
                      : t("activity_show_observations")}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={Colors.main100}
                  />
                </View>
              )}
            </Pressable>
          )}
        </View>

        {top.length > 0 && periods && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("activity_top_periods")}</Text>
            {top.map((index, i) => (
              <Pressable
                key={index}
                style={[styles.topRow, i > 0 && styles.topRowBorder]}
                onPress={() => openPeriod(index)}
                testID={`activity-top-${i}`}
              >
                <Text style={styles.topPeriod}>
                  {formatPeriodLabel(periods, index, group, lastDay)}
                </Text>
                <Text style={styles.topValue}>{data[index]}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={Colors.textSecondary}
                />
              </Pressable>
            ))}
          </View>
        )}
      </>
    );
  };

  return (
    <Layout withScroll contentContainerStyle={styles.content}>
      {!!meta.from && !!meta.to && (
        <Text style={styles.range} testID="activity-range">
          {meta.from === meta.to
            ? formatRangeDay(meta.from, i18n.language)
            : `${formatRangeDay(meta.from, i18n.language)} – ${formatRangeDay(
                meta.to,
                i18n.language,
              )}`}
        </Text>
      )}

      <ViewSwitch
        options={[
          {
            value: "newSpecies",
            label: t("new_species"),
            icon: "sparkles-outline",
          },
          {
            value: "observations",
            label: t("observations"),
            icon: "binoculars-outline",
          },
        ]}
        value={mode}
        onChange={setMode}
        testIDPrefix="activity-mode"
      />

      {renderBody()}
    </Layout>
  );
};

export default ActivityScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: H_PAD,
      paddingTop: 12,
      paddingBottom: 24,
      gap: 12,
    },
    flex: { flex: 1 },
    range: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    loader: { marginTop: 48 },
    empty: {
      marginTop: 48,
      textAlign: "center",
      fontSize: 14,
      color: Colors.textSecondary,
    },
    kpiRow: {
      flexDirection: "row",
      gap: 12,
    },
    kpi: {
      flex: 1,
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingVertical: 12,
      paddingHorizontal: CARD_PAD,
    },
    kpiValue: {
      fontSize: 24,
      fontWeight: "600",
      color: Colors.textMain,
    },
    kpiLabel: {
      marginTop: 2,
      fontSize: 12,
      color: Colors.textSecondary,
    },
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      padding: CARD_PAD,
    },
    selected: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 0.5,
      borderTopColor: Colors.divider,
    },
    selectedPeriod: {
      fontSize: 14,
      fontWeight: "500",
      color: Colors.textMain,
    },
    selectedValue: {
      marginTop: 2,
      fontSize: 13,
      color: Colors.textSecondary,
    },
    openRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    openText: {
      fontSize: 13,
      color: Colors.main100,
    },
    sectionTitle: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 4,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      gap: 8,
    },
    topRowBorder: {
      borderTopWidth: 0.5,
      borderTopColor: Colors.divider,
    },
    topPeriod: {
      flex: 1,
      fontSize: 14,
      color: Colors.textMain,
    },
    topValue: {
      fontSize: 14,
      fontWeight: "500",
      color: Colors.textMain,
    },
  });
