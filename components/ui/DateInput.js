import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "../../constants/styles";

const formatDate = (date) => (date ? date.toISOString().slice(0, 10) : "");

const DateInput = ({ label, value, onChange, placeholder = "Select date", error, allowClear = true }) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempValue, setTempValue] = useState(value || new Date());

  const openPicker = () => {
    setTempValue(value || new Date());
    setShowPicker(true);
  };
  const closePicker = () => setShowPicker(false);

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      // Android: сразу применяем и закрываем
      if (event.type === "set" && selectedDate) {
        onChange(selectedDate);
      }
      closePicker();
    } else {
      // iOS: сохраняем временно, но не закрываем
      if (event.type === "set" && selectedDate) {
        setTempValue(selectedDate);
      }
      if (event.type === "dismissed") {
        closePicker();
      }
    }
  };

  const confirmDate = () => {
    onChange(tempValue); // Подтверждаем выбранную дату
    closePicker();
  };

  const formattedValue = value ? value.toISOString().slice(0, 10) : "";

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Pressable
        onPress={openPicker}
        style={[styles.input, error && styles.errorBorder]}
      >
        <Text style={[styles.text, !value && styles.placeholder]}>
          {formattedValue || placeholder}
        </Text>

        <View style={styles.icons}>
          {allowClear && value && (
            <Pressable onPress={() => onChange(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </Pressable>
          )}
          <Ionicons name="calendar" size={20} color="#9ca3af" />
        </View>
      </Pressable>

      {showPicker && (
        <View style={styles.pickerWrapper}>
          <DateTimePicker
            value={tempValue}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleChange}
          />

          {Platform.OS === "ios" && (
            <Pressable style={styles.doneBtn} onPress={confirmDate}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          )}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};


export default DateInput;

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },

  label: {
    fontSize: 14,
    marginBottom: 4,
    color: Colors.textMain,
  },

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

  placeholder: { color: "#9ca3af" },

  icons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  pickerWrapper: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 8,
  },

  currentValue: {
    textAlign: "center",
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },

  doneBtn: {
    marginTop: 8,
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  doneText: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: "600",
  },

  error: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.error500,
  },

  errorBorder: {
    borderColor: Colors.error500,
  },
});
