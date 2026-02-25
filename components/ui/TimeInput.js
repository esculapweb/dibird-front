import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../store/theme-context";

const TimeInput = ({
  label,
  value,
  onChange,
  placeholder = "Select time",
  error,
}) => {
  const { t } = useTranslation();
  const { Colors, theme } = useTheme();
  const styles = stylesFn(Colors);

  const [showPicker, setShowPicker] = useState(false);
  const [tempValue, setTempValue] = useState(value || new Date());

  const openPicker = () => {
    const d = value || new Date();
    const temp = new Date(2000, 0, 1, d.getHours(), d.getMinutes());
    setTempValue(temp);
    setShowPicker(true);
  };

  const closePicker = () => setShowPicker(false);

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      if (event.type === "set" && selectedDate) {
        onChange(selectedDate);
      }
      closePicker();
    } else {
      if (event.type === "set" && selectedDate) setTempValue(selectedDate);
      if (event.type === "dismissed") closePicker();
    }
  };

  const confirmTime = () => {
    onChange(tempValue);
    closePicker();
  };

  const formatTime = (date) => {
    if (!date) return "";
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Pressable
        onPress={openPicker}
        style={[styles.input, error && styles.errorBorder]}
      >
        <Text style={[styles.text, !value && styles.placeholder]}>
          {value ? formatTime(value) : placeholder}
        </Text>
        <Ionicons name="time" size={20} color={Colors.textSecondary} />
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={tempValue}
          mode="time"
          is24Hour={true}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          themeVariant={theme === "dark" ? "dark" : "light"}
          onChange={handleChange}
        />
      )}

      {Platform.OS === "ios" && showPicker && (
        <Pressable style={styles.doneBtn} onPress={confirmTime}>
          <Text style={styles.doneText}>{t("done")}</Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

export default TimeInput;

const stylesFn = (Colors) =>
  StyleSheet.create({
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
    text: { fontSize: 16, color: Colors.textMain },
    placeholder: { color: Colors.textSecondary },
    error: { marginTop: 4, fontSize: 12, color: Colors.error500 },
    errorBorder: { borderColor: Colors.error500 },
    doneBtn: { marginTop: 8, alignSelf: "flex-end", padding: 8 },
    doneText: { fontSize: 16, color: Colors.done, fontWeight: "600" },
  });
