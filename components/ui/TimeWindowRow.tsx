import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { HourPicker } from "./HourPicker";
import { ThemeColors } from "../../store/theme-context";
import type { ActiveHourWindow } from "../../services/alertSettings";

interface TimeWindowRowProps {
  window: ActiveHourWindow;
  index: number;
  onChangeStart: (h: number) => void;
  onChangeEnd: (h: number) => void;
  onRemove: () => void;
  colors: ThemeColors;
}

export function TimeWindowRow({
  window: [start, end],
  index,
  onChangeStart,
  onChangeEnd,
  onRemove,
  colors,
}: TimeWindowRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const styles = stylesFn(colors);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((x) => !x)}
        activeOpacity={0.6}
      >
        <Ionicons name="time-outline" size={16} color={colors.main100} />
        <Text style={styles.label}>
          {`${index + 1}. ${String(start).padStart(2, "0") + ":00"} - ${String(end).padStart(2, "00") + ":00"}`}
        </Text>
        <View style={styles.actions}>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
          <TouchableOpacity onPress={onRemove} hitSlop={12}>
            <Ionicons name="close-circle-outline" size={20} color={colors.error600} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.pickers}>
          {(
            [
              { labelKey: t("from"), val: start, cb: onChangeStart },
              { labelKey: t("to"), val: end, cb: onChangeEnd },
            ] as const
          ).map(({ labelKey, val, cb }) => (
            <View key={labelKey} style={styles.pickerCol}>
              <Text style={styles.pickerLabel}>{t(labelKey)}</Text>
              <HourPicker value={val} onChange={cb} colors={colors} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const stylesFn = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
      backgroundColor: colors.primary100,
      borderColor: colors.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      gap: 8,
    },
    label: { flex: 1, fontSize: 14, color: colors.textMain },
    actions: { flexDirection: "row", alignItems: "center", gap: 8 },
    pickers: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      padding: 12,
      gap: 12,
    },
    pickerCol: { gap: 6 },
    pickerLabel: {
      fontSize: 11,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: colors.textSecondary,
    },
  });