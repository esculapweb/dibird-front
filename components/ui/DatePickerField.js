import { useState } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTheme } from "../../store/theme-context";

const DatePickerField = ({ label, date, setDate }) => {
  const { Colors } = useTheme();
  const [show, setShow] = useState(false);

  const onChange = (event, selectedDate) => {
    if (Platform.OS === "android") setShow(false); 
    if (selectedDate) setDate(selectedDate);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: Colors.text }]}>{label}</Text>

      <Pressable
        onPress={() => setShow(true)}
        style={[styles.button, { borderColor: Colors.border }]}
      >
        <Text style={{ color: Colors.text }}>
          {date ? date.toLocaleDateString() : "—"}
        </Text>
      </Pressable>

      {show && (
        <DateTimePicker
          value={date || new Date()}
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
  container: {
    marginVertical: 8,
  },
  label: {
    marginBottom: 4,
    fontSize: 14,
    fontWeight: "500",
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 6,
  },
});
