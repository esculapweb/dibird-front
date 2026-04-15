import { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../../store/theme-context";
import i18n from "../../services/i18n";

const toDateOnly = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date + "T00:00:00");
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toPickerDate = (value) => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return new Date(value + "T00:00:00");
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString(i18n.language);
};

// value: string "YYYY-MM-DD" | null
// setDate: (string "YYYY-MM-DD" | null) => void
const DatePickerField = ({ label, date, setDate }) => {
  const { Colors } = useTheme();
  const [show, setShow] = useState(false);

  const onChange = (event, selectedDate) => {
    if (Platform.OS === "android") setShow(false);
    if (selectedDate) setDate(toDateOnly(selectedDate));
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: Colors.text }]}>{label}</Text>

      <Pressable
        onPress={() => setShow(true)}
        style={[styles.button, { borderColor: Colors.border }]}
      >
        <Text style={{ color: Colors.text }}>{formatDate(date)}</Text>
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
