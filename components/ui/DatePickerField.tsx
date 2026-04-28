import { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useTheme } from "../../store/theme-context";
import i18n from "../../services/i18n";

const toDateOnly = (date: string | Date | null): string | null => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date + "T00:00:00");
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toPickerDate = (value: string | Date | null): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return new Date(value + "T00:00:00");
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString(i18n.language);
};

// value: string "YYYY-MM-DD" | null
// setDate: (string "YYYY-MM-DD" | null) => void
const DatePickerField = ({
  label,
  date,
  setDate,
}: {
  label: string;
  date: string | null;
  setDate: (date: string | null) => void;
}) => {
  const { Colors } = useTheme();
  const [show, setShow] = useState(false);

  const onChange = (
    event: DateTimePickerEvent,
    selectedDate: Date | undefined,
  ) => {
    if (Platform.OS === "android") setShow(false);
    if (selectedDate) setDate(toDateOnly(selectedDate));
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: Colors.textMain }]}>{label}</Text>

      <Pressable
        onPress={() => setShow(true)}
        style={[styles.button, { borderColor: Colors.border }]}
      >
        <Text style={{ color: Colors.textMain }}>{formatDate(date)}</Text>
      </Pressable>

      {show && (
        <DateTimePicker
          value={toPickerDate(date)}
          mode="date"
          display="default"
          onChange={onChange}
          maximumDate={new Date()}
        />
      )}
    </View>
  );
};

export default DatePickerField;

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  label: { marginBottom: 4, fontSize: 14, fontWeight: "500" },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 6,
  },
});
