import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import DateInput from "../ui/DateInput";
import TimeChip from "../ui/TimeChip";
import FlatButton from "../ui/FlatButton";
import { formatDateTime } from "../../util/helpers";
import { combineReminder, splitReminder } from "../../util/reminderDateTime";

const H_PAD = 12;

interface PlaceReminderBlockProps {
  reminderAt: string | null | undefined;
  onSave: (iso: string | null) => void;
  disabled?: boolean;
}

const PlaceReminderBlock = ({
  reminderAt,
  onSave,
  disabled = false,
}: PlaceReminderBlockProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);

  // Re-seeded from the place whenever its stored reminder changes — after a
  // save, a pull-to-refresh, or a reconcile with another device.
  useEffect(() => {
    const current = splitReminder(reminderAt);
    setDate(current.date);
    setTime(current.time);
  }, [reminderAt]);

  const picked = combineReminder(date, time);
  const isPast = !!picked && picked.getTime() <= Date.now();
  const isChanged =
    (picked?.getTime() ?? null) !==
    (reminderAt ? new Date(reminderAt).getTime() : null);
  const canSave = !!picked && !isPast && isChanged && !disabled;

  const isActive =
    !!reminderAt && new Date(reminderAt).getTime() > Date.now();

  return (
    <View style={styles.block} testID="place-reminder-block">
      <Text style={styles.title}>{t("visit_reminder")}</Text>
      {reminderAt ? (
        <Text style={styles.hint}>
          {isActive
            ? formatDateTime(reminderAt)
            : t("reminder_passed", { date: formatDateTime(reminderAt) })}
        </Text>
      ) : null}

      <DateInput
        testID="place-reminder-date-input"
        value={date}
        onChange={setDate}
        placeholder={t("reminder_date")}
        error={isPast ? t("reminder_in_past") : null}
        minimumDate={new Date()}
        capAtToday={false}
        allowClear={false}
        disabled={disabled}
        style={{ marginVertical: 12 }}
        trailing={
          <TimeChip
            value={time}
            onChange={setTime}
            disabled={disabled}
            testID="place-reminder-time-chip"
          />
        }
      />

      <View style={styles.actions}>
        {reminderAt ? (
          <FlatButton onPress={() => !disabled && onSave(null)}>
            {t("delete_reminder")}
          </FlatButton>
        ) : null}
        {canSave ? (
          <FlatButton onPress={() => onSave(picked.toISOString())}>
            {t("set_reminder")}
          </FlatButton>
        ) : null}
      </View>
    </View>
  );
};

export default PlaceReminderBlock;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    block: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      padding: H_PAD,
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
    },
    hint: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginTop: 4,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
    },
  });
