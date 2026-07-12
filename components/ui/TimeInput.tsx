import { useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  LayoutAnimation,
} from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { useTheme, ThemeColors } from "../../store/theme-context";

import {
  formatTimeString,
  timeStringToDate,
  dateToTimeString,
} from "../../util/timeHelpers";

interface TimeInputProps {
  label?: string;
  value: string;
  onChange: (value: string | null) => void;
  error?: boolean | string | null;
  allowClear?: boolean;
  disabled?: boolean;
}

const TimeInput = ({
  label,
  value,
  onChange,
  error,
  allowClear = true,
  disabled = false,
}: TimeInputProps) => {
  const { t } = useTranslation();
  const { Colors, theme } = useTheme();
  const styles = stylesFn(Colors);
  const placeholder = t("select_time");

  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  // tempDate — локальное состояние пикера, не связано с value извне.
  // Это предотвращает баг когда обновление value снаружи сбивает позицию спиннера.
  const [tempDate, setTempDate] = useState(() => timeStringToDate(value));

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animatePress = useCallback(
    (toValue: number) => {
      Animated.spring(scaleAnim, {
        toValue,
        useNativeDriver: true,
        speed: 30,
        bounciness: 4,
      }).start();
    },
    [scaleAnim],
  );

  const handleFieldPress = useCallback(() => {
    if (disabled) return;
    Haptics.selectionAsync();

    if (Platform.OS === "android") {
      setAndroidPickerOpen(true);
    } else {
      const initial = value ? timeStringToDate(value) : new Date();
      setTempDate(initial);

      if (!value) onChange(dateToTimeString(initial));

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIosOpen((prev) => !prev);
    }
  }, [disabled, value, onChange]);

  const handleAndroidChange = useCallback(
    (event: DateTimePickerEvent, selectedDate: Date | undefined) => {
      setAndroidPickerOpen(false);
      if (event.type === "set" && selectedDate) {
        onChange(dateToTimeString(selectedDate));
        Haptics.selectionAsync();
      }
    },
    [onChange],
  );

  const handleIosChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate: Date | undefined) => {
      if (!selectedDate) return;
      setTempDate(selectedDate);
      onChange(dateToTimeString(selectedDate));
    },
    [onChange],
  );

  const handleClose = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIosOpen(false);
  }, []);

  const handleClear = useCallback(() => {
    onChange(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onChange]);

  const isOpen = Platform.OS === "ios" ? iosOpen : false;
  const displayValue = value ? formatTimeString(value) : null;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={handleFieldPress}
          onPressIn={() => !disabled && animatePress(0.97)}
          onPressOut={() => animatePress(1)}
          style={({ pressed }) => [
            styles.input,
            error && styles.errorBorder,
            disabled && styles.inputDisabled,
            isOpen && styles.inputOpen,
            pressed && !disabled && styles.inputPressed,
          ]}
          disabled={disabled}
        >
          <Text
            style={[
              styles.text,
              !displayValue && styles.placeholder,
              disabled && styles.textDisabled,
            ]}
          >
            {displayValue ?? placeholder}
          </Text>

          <View style={styles.icons}>
            {allowClear && displayValue && !disabled && (
              <Pressable onPress={handleClear} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Colors.dropdownIcon}
                />
              </Pressable>
            )}
            <Ionicons
              name={isOpen ? "chevron-up" : "time"}
              size={20}
              color={Colors.textSecondary}
            />
          </View>
        </Pressable>
      </Animated.View>

      {error && !isOpen && <Text style={styles.error}>{error}</Text>}

      {Platform.OS === "android" && androidPickerOpen && (
        <DateTimePicker
          value={timeStringToDate(value)}
          mode="time"
          is24Hour
          display="default"
          onChange={handleAndroidChange}
        />
      )}

      {Platform.OS === "ios" && iosOpen && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={styles.doneText}>{t("done")}</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={tempDate}
            mode="time"
            maximumDate={new Date(9999, 11, 31, 23, 59, 59)}
            is24Hour
            display="spinner"
            themeVariant={theme === "dark" ? "dark" : "light"}
            onChange={handleIosChange}
            style={styles.picker}
          />
        </View>
      )}
    </View>
  );
};

export default TimeInput;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: { marginBottom: 12 },
    label: { fontSize: 14, marginBottom: 4, color: Colors.textMain },
    input: {
      height: 40,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: Colors.primary100,
    },
    inputOpen: {
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderBottomColor: Colors.primary200,
    },
    inputPressed: { backgroundColor: Colors.primary200 },
    inputDisabled: { opacity: 0.5 },
    text: { fontSize: 16, color: Colors.textMain },
    placeholder: { color: Colors.textSecondary },
    textDisabled: { color: Colors.textSecondary },
    icons: { flexDirection: "row", alignItems: "center", gap: 6 },
    error: { marginTop: 4, fontSize: 12, color: Colors.error500 },
    errorBorder: { borderColor: Colors.error500 },
    panel: {
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: Colors.border,
      borderBottomLeftRadius: 6,
      borderBottomRightRadius: 6,
      backgroundColor: Colors.primary100,
      overflow: "hidden",
    },
    panelHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    doneText: { fontSize: 15, fontWeight: "600", color: Colors.main100 },
    picker: { alignSelf: "stretch" },
  });
