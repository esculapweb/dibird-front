import { View, Text, StyleSheet, Pressable, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import DateInput from "../ui/DateInput";
import TimeChip from "../ui/TimeChip";

interface WantToVisitSectionProps {
  value: boolean;
  onChange: (value: boolean) => void;
  reminderDate: string | null;
  reminderTime: string | null;
  onReminderDateChange: (value: string | null) => void;
  onReminderTimeChange: (value: string | null) => void;
  reminderError?: string | null;
}

/**
 * The place editor's "want to visit" switch with its optional reminder.
 *
 * The reminder fields are shown only while the switch is on — a reminder for a
 * place the user does not plan to visit is what PlaceDetailScreen clears on
 * un-flagging too. Both fields are optional: a date without a time (or the
 * other way round) simply sets no reminder; see PlaceEditorScreen's validation.
 */
const WantToVisitSection = ({
  value,
  onChange,
  reminderDate,
  reminderTime,
  onReminderDateChange,
  onReminderTimeChange,
  reminderError,
}: WantToVisitSectionProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.row}
        onPress={() => onChange(!value)}
        testID="place-want-to-visit-toggle"
      >
        <View style={[styles.iconWrap, value && styles.iconWrapActive]}>
          <Ionicons
            name={value ? "flag" : "flag-outline"}
            size={18}
            color={value ? Colors.textOpposite : Colors.textSecondary}
          />
        </View>
        <Text style={styles.label}>{t("want_to_visit")}</Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: Colors.border, true: Colors.wantToVisit }}
          thumbColor={Colors.primary100}
        />
      </Pressable>

      {value && (
        <DateInput
          testID="place-reminder-date-input"
          label={t("visit_reminder")}
          value={reminderDate}
          onChange={onReminderDateChange}
          placeholder={t("reminder_date")}
          error={reminderError}
          minimumDate={new Date()}
          capAtToday={false}
          allowClear
          style={{ marginTop: 12 }}
          trailing={
            <TimeChip
              value={reminderTime}
              onChange={onReminderTimeChange}
              testID="place-reminder-time-chip"
            />
          }
        />
      )}
    </View>
  );
};

export default WantToVisitSection;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    section: { paddingHorizontal: 16, paddingBottom: 16 },
    row: { flexDirection: "row", alignItems: "center", gap: 12 },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.border,
    },
    iconWrapActive: { backgroundColor: Colors.wantToVisit },
    label: { flex: 1, fontSize: 15, color: Colors.textMain },
  });
