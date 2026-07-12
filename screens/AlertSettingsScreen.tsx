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
import { Ionicons } from "@expo/vector-icons";

import Layout from "../components/ui/Layout";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { TimeWindowRow } from "../components/ui/TimeWindowRow";
import { ThemeColors, useTheme } from "../store/theme-context";
import { useLocation } from "../store/location-context";
import { isoToFlagEmoji } from "../util/helpers";
import { useLocationUnavailable } from "../hooks/useLocationUnavailable";
import RadiusRow from "../components/ui/RadiusRow";
import { useAlertSettings } from "../store/alert-settings-context";
import type {
  AlertSettingsPatch,
  ActiveHourWindow,
} from "../services/alertSettings";

const SEEN_MODE_OPTIONS = [
  { value: "year", labelKey: "alert_seen_mode_year" },
  { value: "alltime", labelKey: "alert_seen_mode_alltime" },
] as const;

const snapDec = (val: number, step = 5, min = 1) =>
  Math.max(min, (Math.ceil(val / step) - 1) * step);
const snapInc = (val: number, step = 5, max = 500) =>
  Math.min(max, (Math.floor(val / step) + 1) * step);

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
  const handleLocationUnavailable = useLocationUnavailable(
    t("location_unavailable_alert_hint"),
  );

  // settings hook — expose error + refetch same pattern as useList in ListScreen
  const { settings, loading, error, refresh, save } =
    useAlertSettings();
  const { requestLocation, isRequesting, permissionStatus } = useLocation();

  const [localRadius, setLocalRadius] = useState(250);
  const [localWindows, setLocalWindows] = useState<ActiveHourWindow[]>([]);

  useEffect(() => {
    if (!settings) return;
    setLocalRadius(settings.radius_km);
    setLocalWindows(settings.active_hours_utc);
  }, [settings?.radius_km, settings?.active_hours_utc]);

  const handleRequestLocation = async () => {
    if (permissionStatus === "denied") {
      handleLocationUnavailable();
      return;
    }
    try {
      const result = await requestLocation();
      if (result) {
        await save(
          {
            lat: Math.round(result.coords[1] * 100) / 100,
            lon: Math.round(result.coords[0] * 100) / 100,
          },
          true,
        );
      } else if (permissionStatus === "denied") {
        handleLocationUnavailable();
      }
    } catch (e) {
      if (__DEV__) console.warn("Failed to use location:", e);
    }
  };

  // Only block the whole screen when there's truly nothing to show yet —
  // once settings are cached locally, a failed refresh/save is surfaced as a
  // toast instead (see useAlertSettings' save()), so offline edits keep
  // working against the cached data.
  if (error && !settings) {
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

  const countryFlag = `${isoToFlagEmoji(settings.territory_data?.code)}`;
  const countryName = settings.territory_data?.name;

  const seenModeOptions = SEEN_MODE_OPTIONS.map((opt) => ({
    label: t(opt.labelKey),
    value: opt.value as string,
  }));

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

          <View style={styles.rowContent}>
            <View style={styles.topRow}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>
                  {countryFlag} {coordLabel}
                </Text>
                <Text style={styles.rowDesc}>{countryName}</Text>
              </View>

              <TouchableOpacity
                onPress={handleRequestLocation}
                disabled={isRequesting}
                style={styles.btn}
              >
                {isRequesting ? (
                  <ActivityIndicator size="small" color={Colors.primary100} />
                ) : (
                  <Text style={styles.btnText}>{t("alert_locate_me")}</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.rowDesc}>
              {settings.location_lat != null
                ? t("alert_location_subtitle")
                : t("alert_location_no_coords")}
            </Text>
          </View>
        </View>

        <Divider styles={styles} />

        <View style={styles.row}>
          <Ionicons name="radio-outline" size={18} color={Colors.main100} />
  
          <View style={styles.rowText}>
            <RadiusRow
              value={localRadius}
              onChange={setLocalRadius}
              onSave={(v: number) => save({ radius_km: v })}
              hint={t("alert_radius_hint")}
            />
          </View>
        </View>
      </Section>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <Section title={t("alert_section_filters")} styles={styles}>
        {/* Опция 1: все виды */}
        <TouchableOpacity
          style={styles.row}
          onPress={() => save({ watchlist_only: false })}
          activeOpacity={0.7}
        >
          <Ionicons
            name={
              !settings.watchlist_only ? "radio-button-on" : "radio-button-off"
            }
            size={18}
            color={
              !settings.watchlist_only ? Colors.main100 : Colors.textSecondary
            }
          />
          <View style={styles.rowText}>
            <Text
              style={[
                styles.rowLabel,
                !settings.watchlist_only && styles.rowLabelActive,
              ]}
            >
              {t("alert_filter_all")}
            </Text>
            <Text style={styles.rowDesc}>{t("alert_filter_all_desc")}</Text>
          </View>
        </TouchableOpacity>

        <Divider styles={styles} />

        <TouchableOpacity
          style={styles.row}
          onPress={() => save({ watchlist_only: true })}
          activeOpacity={0.7}
        >
          <Ionicons
            name={
              settings.watchlist_only ? "radio-button-on" : "radio-button-off"
            }
            size={18}
            color={
              settings.watchlist_only ? Colors.main100 : Colors.textSecondary
            }
          />
          <View style={styles.rowText}>
            <Text
              style={[
                styles.rowLabel,
                settings.watchlist_only && styles.rowLabelActive,
              ]}
            >
              {t("alert_watchlist_only")}
            </Text>
            <Text style={styles.rowDesc}>{t("alert_watchlist_only_desc")}</Text>
          </View>
        </TouchableOpacity>

        {settings.watchlist_only && (
          <>
            <Divider styles={styles} />
            <View style={styles.subRowWrapper}>
              {seenModeOptions.map((opt) => (
                <View key={opt.value}>
                  <TouchableOpacity
                    style={[styles.row, styles.subRow]}
                    onPress={() =>
                      save({
                        seen_mode: opt.value as AlertSettingsPatch["seen_mode"],
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={
                        settings.seen_mode === opt.value
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={18}
                      color={
                        settings.seen_mode === opt.value
                          ? Colors.main100
                          : Colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.rowLabel,
                        settings.seen_mode === opt.value &&
                          styles.rowLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}
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

      <View style={styles.bottom}></View>
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

    rowLabelActive: {
      color: Colors.main100,
      fontWeight: "600",
    },
    subOption: {
      paddingLeft: 44, 
      paddingRight: 14,
      paddingVertical: 8,
    },
    subRowWrapper: {
      paddingLeft: 28,
      paddingVertical: 8,
      flexDirection: "row",
      justifyContent: "flex-start",
      alignItems: "center",
      gap: 10,
    },
    subRow: {
      gap: 8,
    },

    rowContent: {
      flex: 1,
    },

    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },

    bottom: {
      paddingVertical: 16
    }
  });

//  t("alert_seen_mode_year")
// t("alert_seen_mode_alltime")
