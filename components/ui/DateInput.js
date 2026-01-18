import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "../../constants/styles";

const DateInput = ({ label, value, onChange, placeholder = "Select date", error }) => {
  const [showPicker, setShowPicker] = useState(false);

  const openPicker = () => setShowPicker(true);
  const closePicker = () => setShowPicker(false);

  const handleChange = (event, selectedDate) => {
    closePicker();
    if (selectedDate) onChange(selectedDate);
  };

  const formattedValue = value ? value.toISOString().slice(0, 10) : "";

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Pressable
        onPress={openPicker}
        style={[styles.input, error && { borderColor: Colors.error500 }]}
      >
        <Text style={[styles.text, !value && { color: "#9ca3af" }]}>
          {formattedValue || placeholder}
        </Text>
        <Ionicons name="calendar" size={20} color="#9ca3af" />
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={value || new Date()}
          mode="date"
          display="default"
          onChange={handleChange}
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

export default DateInput;

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: { fontSize: 14, marginBottom: 4, color: Colors.textMain },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primary100,
  },
  text: { fontSize: 16 },
  error: { marginTop: 4, fontSize: 12, color: Colors.error500 },
});
