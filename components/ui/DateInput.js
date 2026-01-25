import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";

const getTodayEnd = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

const formatDate = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const DateInput = ({
  label,
  value,
  onChange,
  placeholder = "Select date",
  error,
  minimumDate,
  allowClear = true,
}) => {
  const { t } = useTranslation();
  const { Colors, theme } = useTheme();
  const styles = stylesFn(Colors);
  const today = getTodayEnd();

  const [showPicker, setShowPicker] = useState(false);
  const [tempValue, setTempValue] = useState(value || today);

  const openPicker = () => {
    setTempValue(value || today);
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
      if (event.type === "set" && selectedDate) {
        setTempValue(selectedDate);
      }
      if (event.type === "dismissed") {
        closePicker();
      }
    }
  };

  const confirmDate = () => {
    onChange(tempValue);
    closePicker();
  };

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Pressable
        onPress={openPicker}
        style={[
          styles.input,
          showPicker && styles.inputActive,
          error && styles.errorBorder,
        ]}
      >
        <Text style={[styles.text, !value && styles.placeholder]}>
          {value ? formatDate(value) : placeholder}
        </Text>

        <View style={styles.icons}>
          {allowClear && value && (
            <Pressable onPress={() => onChange(null)} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={18}
                color={Colors.dropdownIcon}
              />
            </Pressable>
          )}
          <Ionicons name="calendar" size={20} color={Colors.textSecondary} />
        </View>
      </Pressable>

      {showPicker && (
        <View style={styles.pickerWrapper}>
          <DateTimePicker
            value={tempValue}
            mode="date"
            maximumDate={today}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            themeVariant={theme === "dark" ? "dark" : "light"}
            onChange={handleChange}
            {...(minimumDate ? { minimumDate } : {})}
            style={{ color: Colors.textMain }}
          />

          {Platform.OS === "ios" && (
            <Pressable style={styles.doneBtn} onPress={confirmDate}>
              <Text style={styles.doneText}>{t('done')}</Text>
            </Pressable>
          )}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

export default DateInput;

const stylesFn = (Colors) =>
  StyleSheet.create({
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
      backgroundColor: Colors.backgroundColor,
    },

    text: { fontSize: 16, color: Colors.textMain },

    placeholder: { color: Colors.textSecondary },

    icons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    pickerWrapper: {
      marginTop: 8,
      backgroundColor: Colors.primary100,
      borderRadius: 8,
      padding: 8,
      borderWidth: 1,
      borderColor: Colors.border,
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
      color: Colors.done,
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

    inputActive: {
      backgroundColor: Colors.primary100,
    },
  });
