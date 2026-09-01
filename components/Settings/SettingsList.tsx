import { Children, Fragment, ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { ThemeColors, useTheme } from "../../store/theme-context";
import { IconType } from "../../types";

// Row and section primitives shared by the settings tree (SettingsScreen and
// the screens it leads to). They read the theme themselves rather than taking
// `colors`/`styles`: these screens are long lists of static rows, and threading
// two props through every one of them was most of the noise in the markup.

interface SectionProps {
  // A section without a title renders as a bare card — used for a lone row that
  // has no group to belong to.
  title?: string;
  children: ReactNode;
}

export const Section = ({ title, children }: SectionProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  // Dividers are inserted here instead of by hand at the call site, so that a
  // section can never end up half-divided. `toArray` drops the `false` a
  // conditional row leaves behind, so a hidden row does not leave its divider.
  const rows = Children.toArray(children);

  return (
    <View style={styles.section}>
      {title ? (
        <Text style={[styles.sectionTitle, { color: Colors.textSecondary }]}>
          {title}
        </Text>
      ) : null}
      <View style={[styles.sectionCard, { backgroundColor: Colors.primary100 }]}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 && <View style={styles.divider} />}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
};

interface RowProps {
  icon: IconType;
  label: string;
  onPress?: () => void;
  rightLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  hideChevron?: boolean;
}

export const Row = ({
  icon,
  label,
  onPress,
  rightLabel,
  danger = false,
  disabled = false,
  hideChevron = false,
}: RowProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const labelColor = danger ? Colors.error600 : Colors.textMain;
  const iconColor = danger ? Colors.error600 : Colors.main100;

  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.55}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.rowLabel, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {rightLabel ? (
          <Text style={[styles.rowRightLabel, { color: Colors.textSecondary }]}>
            {rightLabel}
          </Text>
        ) : null}
        {!hideChevron && (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={Colors.textSecondary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

interface RowSwitchProps {
  icon: IconType;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}

export const RowSwitch = ({
  icon,
  label,
  value,
  onValueChange,
  disabled = false,
}: RowSwitchProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <Ionicons name={icon} size={18} color={Colors.main100} />
      <Text
        style={[styles.rowLabel, { color: Colors.textMain }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: Colors.main100 }}
        thumbColor={Platform.OS === "android" ? Colors.primary100 : undefined}
      />
    </View>
  );
};

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    section: {
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginBottom: 6,
      marginLeft: 2,
    },
    sectionCard: {
      borderRadius: 14,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
    },
    rowDisabled: {
      opacity: 0.35,
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
    },
    rowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    rowRightLabel: {
      fontSize: 14,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
      marginLeft: 44,
      marginRight: 16,
    },
  });
