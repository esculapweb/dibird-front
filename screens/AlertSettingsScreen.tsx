import { useState, useEffect } from "react";
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import Layout from "../components/ui/Layout";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { TimeWindowRow } from "../components/ui/TimeWindowRow";
import { ThemeColors, useTheme } from "../store/theme-context";
import { usePlaceLocation } from "../hooks/Place/usePlaceLocation";
import { useAlertSettings } from "../hooks/useAlertSettings";
import { AppStackNavigationProp } from "../types";
import type {
  AlertSettingsPatch,
  ActiveHourWindow,
} from "../services/alertSettings";

/**
 * Snap value to nearest multiple of step.
 * decrement: finds the next multiple of 5 below current value
 * increment: finds the next multiple of 5 above current value
 */
const snapDec = (val: number, step = 5, min = 5) =>
  Math.max(min, (Math.ceil(val / step) - 1) * step);
const snapInc = (val: number, step = 5, max = 100) =>
  Math.min(max, (Math.floor(val / step) + 1) * step);

// ─── Primitives ───────────────────────────────────────────────────────────────

const Divider = ({ styles }: { styles: ReturnType<typeof stylesFn> }) => (
  <View style={styles.divider} />
);

interface SectionProps {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof stylesFn>;
}

const Section = ({ title, children, styles }: SectionProps) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.sectionCard}>{children}</View>
  </View>
);

interface RowSwitchProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof stylesFn>;
}

const RowSwitch = ({
  icon,
  label,
  subtitle,
  value,
  onValueChange,
  colors,
  styles,
}: RowSwitchProps) => (
  <View style={styles.row}>
    <Ionicons name={icon} size={18} color={colors.main100} />
    <View style={styles.rowText}>
      <Text style={styles.rowLabel}>{label}</Text>
      {subtitle ? <Text style={styles.rowDesc}>{subtitle}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: colors.main100 }}
      thumbColor={Platform.OS === "android" ? colors.primary100 : undefined}
    />
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AlertSettingsScreen() {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();

  // settings hook — expose error + refetch same pattern as useList in ListScreen
  const { settings, loading, saving, error, refresh, save } =
    useAlertSettings();
  const { locateMe, isLoading: locating, coords } = usePlaceLocation();

  const [localRadius, setLocalRadius] = useState(250);
  const [localWindows, setLocalWindows] = useState<ActiveHourWindow[]>([]);

  useEffect(() => {
    if (!settings) return;
    setLocalRadius(settings.radius_km);
    setLocalWindows(settings.active_hours_utc);
  }, [settings?.radius_km, settings?.active_hours_utc]);

  // Save coords from device location
  useEffect(() => {
    if (!coords) return;
    save({
      lat: Math.round(coords[1] * 100) / 100,
      lon: Math.round(coords[0] * 100) / 100,
    } satisfies AlertSettingsPatch);
  }, [coords]);

  if (error) {
    return (
      <ErrorOverlay
        title={t("alert_settings_unavailable")}
        message={error}
        onPress={async () => {
          await refresh();
        }}
        logo
      />
    );
  }
  if (loading || !settings) return <LoadingOverlay />;

  // ─── Derived ─────────────────────────────────────────────────────────────
  const coordLabel =
    settings.location_lat != null && settings.location_lon != null
      ? `${settings.location_lat.toFixed(2)}, ${settings.location_lon.toFixed(2)}`
      : t("alert_location_not_set");

  // ─── Handlers ────────────────────────────────────────────────────────────
  const updateWindow = (idx: number, field: 0 | 1, hour: number) => {
    const next = localWindows.map((w, i) =>
      i === idx
        ? ([
            field === 0 ? hour : w[0],
            field === 1 ? hour : w[1],
          ] as ActiveHourWindow)
        : w,
    );
    setLocalWindows(next);
    save({ active_hours_utc: next });
  };

  const addWindow = () => {
    const next: ActiveHourWindow[] = [...localWindows, [8, 22]];
    setLocalWindows(next);
    save({ active_hours_utc: next });
  };

  const removeWindow = (idx: number) => {
    const next = localWindows.filter((_, i) => i !== idx);
    setLocalWindows(next);
    save({ active_hours_utc: next });
  };

  return (
    <Layout withScroll contentContainerStyle={styles.scroll}>
      {/* ── Master switch ──────────────────────────────────────────────── */}
      <Section title={t("alert_section_general")} styles={styles}>
        <RowSwitch
          icon="notifications-outline"
          label={t("alert_enabled")}
          value={settings.is_enabled}
          onValueChange={(v) => save({ is_enabled: v })}
          colors={Colors}
          styles={styles}
        />
      </Section>

      {/* ── Location + Radius ──────────────────────────────────────────── */}
      <Section title={t("alert_section_location")} styles={styles}>
        <View style={styles.row}>
          <Ionicons name="location-outline" size={18} color={Colors.main100} />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{coordLabel}</Text>
            <Text style={styles.rowDesc}>{t("alert_location_subtitle")}</Text>
          </View>
          <TouchableOpacity
            onPress={locateMe}
            disabled={locating}
            style={styles.btn}
          >
            {locating ? (
              <ActivityIndicator size="small" color={Colors.primary100} />
            ) : (
              <Text style={styles.btnText}>{t("alert_locate_me")}</Text>
            )}
          </TouchableOpacity>
        </View>

        <Divider styles={styles} />

        <View style={styles.row}>
          <Ionicons
            name="radio-button-on-outline"
            size={18}
            color={Colors.main100}
          />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>
              {t("alert_radius_label", { km: localRadius })}
            </Text>
            <Text style={styles.rowDesc}>{t("alert_radius_hint")}</Text>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity
              onPress={() => {
                const next = snapDec(localRadius);
                setLocalRadius(next);
                save({ radius_km: next });
              }}
            >
              <Text style={styles.stepBtn}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepVal}>{localRadius}</Text>
            <TouchableOpacity
              onPress={() => {
                const next = snapInc(localRadius);
                setLocalRadius(next);
                save({ radius_km: next });
              }}
            >
              <Text style={styles.stepBtn}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Section>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <Section title={t("alert_section_filters")} styles={styles}>
        <RowSwitch
          icon="bookmark-outline"
          label={t("alert_watchlist_only")}
          subtitle={t("alert_watchlist_only_desc")}
          value={settings.watchlist_only}
          onValueChange={(v) => save({ watchlist_only: v })}
          colors={Colors}
          styles={styles}
        />
        <Divider styles={styles} />
        {/* ── Watchlist editor navigation ──────────────────────────────── */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate("WatchlistEditor")}
          activeOpacity={0.7}
        >
          <Ionicons name="list-outline" size={18} color={Colors.main100} />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>{t("alert_watchlist")}</Text>
            <Text style={styles.rowDesc}>{t("alert_watchlist_nav_desc")}</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>
      </Section>

      {/* ── Schedule ───────────────────────────────────────────────────── */}
      <Section title={t("alert_section_schedule")} styles={styles}>
        {localWindows.length === 0 ? (
          <View style={styles.row}>
            <Ionicons
              name="time-outline"
              size={18}
              color={Colors.textSecondary}
            />
            <Text style={styles.rowDescFlex}>{t("alert_schedule_empty")}</Text>
          </View>
        ) : (
          <View style={styles.windowList}>
            {localWindows.map((w, idx) => (
              <TimeWindowRow
                key={idx}
                window={w}
                index={idx}
                onChangeStart={(h) => updateWindow(idx, 0, h)}
                onChangeEnd={(h) => updateWindow(idx, 1, h)}
                onRemove={() => removeWindow(idx)}
                colors={Colors}
              />
            ))}
          </View>
        )}

        {localWindows.length > 0 && <Divider styles={styles} />}

        <TouchableOpacity
          style={styles.row}
          onPress={addWindow}
          activeOpacity={0.6}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={Colors.main100}
          />
          <Text style={styles.rowLabelAccent}>{t("alert_add_window")}</Text>
        </TouchableOpacity>
      </Section>

      {/* ── Limits ─────────────────────────────────────────────────────── */}
      <Section title={t("alert_section_limits")} styles={styles}>
        <View style={styles.row}>
          <Ionicons name="shield-outline" size={18} color={Colors.main100} />
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>
              {t("alert_max_per_day_label", { n: settings.max_alerts_per_day })}
            </Text>
            <Text style={styles.rowDesc}>{t("alert_max_per_day_desc")}</Text>
          </View>
          <View style={styles.stepper}>
            <TouchableOpacity
              onPress={() =>
                save({
                  max_alerts_per_day: snapDec(settings.max_alerts_per_day),
                })
              }
            >
              <Text style={styles.stepBtn}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepVal}>{settings.max_alerts_per_day}</Text>
            <TouchableOpacity
              onPress={() =>
                save({
                  max_alerts_per_day: snapInc(settings.max_alerts_per_day),
                })
              }
            >
              <Text style={styles.stepBtn}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Section>

      {saving && <Text style={styles.saving}>{t("saving")}</Text>}
    </Layout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { paddingHorizontal: 16 },

    section: { marginTop: 24 },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginBottom: 6,
      marginLeft: 2,
      color: Colors.textSecondary,
    },
    sectionCard: {
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: Colors.primary100,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
    },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 15, color: Colors.textMain },
    rowLabelAccent: { fontSize: 15, color: Colors.main100 },
    rowDesc: {
      fontSize: 12,
      marginTop: 2,
      lineHeight: 16,
      color: Colors.textSecondary,
    },
    rowDescFlex: {
      fontSize: 12,
      marginTop: 2,
      lineHeight: 16,
      color: Colors.textSecondary,
      flex: 1,
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 44,
      marginRight: 14,
      backgroundColor: Colors.border,
    },

    dropdownWrap: { paddingHorizontal: 14, paddingVertical: 8 },

    radioGroupWrap: { paddingHorizontal: 14, paddingVertical: 12 },

    windowList: { paddingHorizontal: 14, paddingTop: 8, gap: 8 },

    btn: {
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minWidth: 80,
      alignItems: "center",
      backgroundColor: Colors.main100,
    },
    btnText: { fontSize: 13, fontWeight: "600", color: Colors.primary100 },

    stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
    stepBtn: { fontSize: 22, paddingHorizontal: 4, color: Colors.main100 },
    stepVal: {
      fontSize: 16,
      fontWeight: "600",
      minWidth: 28,
      textAlign: "center",
      color: Colors.textMain,
    },

    saving: {
      textAlign: "center",
      marginTop: 16,
      marginBottom: 8,
      fontSize: 13,
      color: Colors.textSecondary,
    },
  });
