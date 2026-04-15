import { useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  LayoutAnimation,
  UIManager,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../store/theme-context";
import { toDateOnly } from "../../util/helpers";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const formatDate = (dateStr, locale = "ru") => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};


const toPickerDate = (value) => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return new Date(value + "T00:00:00");
};

const getTodayEnd = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

const DateInput = ({
  label,
  value, // string "YYYY-MM-DD" | null
  onChange, // (string "YYYY-MM-DD" | null) => void
  placeholder = "Select date",
  error,
  minimumDate, // string "YYYY-MM-DD" | Date | undefined
  allowClear = true,
  disabled = false,
  style,
}) => {
  const { t, i18n } = useTranslation();
  const { Colors, theme } = useTheme();
  const styles = stylesFn(Colors);

  const today = getTodayEnd();

  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [tempDate, setTempDate] = useState(() => toPickerDate(value));

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animatePress = useCallback(
    (toValue) => {
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
      setTempDate(toPickerDate(value));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIosOpen((prev) => !prev);
    }
  }, [disabled, value]);

  const handleAndroidChange = useCallback(
    (event, selectedDate) => {
      setAndroidPickerOpen(false);
      if (event.type === "set" && selectedDate) {
        onChange(toDateOnly(selectedDate));
        Haptics.selectionAsync();
      }
    },
    [onChange],
  );

  const handleIosChange = useCallback(
    (_event, selectedDate) => {
      if (!selectedDate) return;
      setTempDate(selectedDate);
      onChange(toDateOnly(selectedDate));
    },
    [onChange],
  );

  const handleClose = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIosOpen(false);
    if (!value) onChange(toDateOnly(tempDate));
  }, [value, tempDate, onChange]);

  const handleToday = useCallback(() => {
    const now = new Date();
    if (Platform.OS === "ios") {
      setTempDate(now);
    } else {
      setAndroidPickerOpen(false);
    }
    onChange(toDateOnly(now));
    Haptics.selectionAsync();
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onChange]);

  // minimumDate может прийти строкой — пикер требует Date
  const minDateObj = minimumDate ? toPickerDate(minimumDate) : undefined;

  const isOpen = Platform.OS === "ios" ? iosOpen : false;

  return (
    <View style={style}>
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
              !value && styles.placeholder,
              disabled && styles.textDisabled,
            ]}
          >
            {value ? formatDate(value, i18n.language) : placeholder}
          </Text>

          <View style={styles.icons}>
            {allowClear && value && !disabled && (
              <Pressable onPress={handleClear} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Colors.dropdownIcon}
                />
              </Pressable>
            )}
            <Ionicons
              name={isOpen ? "chevron-up" : "calendar"}
              size={20}
              color={Colors.textSecondary}
            />
          </View>
        </Pressable>
      </Animated.View>

      {error && !isOpen && <Text style={styles.error}>{error}</Text>}

      {Platform.OS === "android" && androidPickerOpen && (
        <DateTimePicker
          value={toPickerDate(value)}
          mode="date"
          display="default"
          maximumDate={today}
          onChange={handleAndroidChange}
          {...(minDateObj ? { minimumDate: minDateObj } : {})}
        />
      )}

      {Platform.OS === "ios" && iosOpen && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Pressable
              onPress={handleToday}
              style={({ pressed }) => [
                styles.todayBtn,
                pressed && styles.todayBtnPressed,
              ]}
            >
              <Ionicons name="today-outline" size={14} color={Colors.main100} />
              <Text style={styles.todayText}>{t("today")}</Text>
            </Pressable>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Text style={styles.doneText}>{t("done")}</Text>
            </Pressable>
          </View>

          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            maximumDate={today}
            themeVariant={theme === "dark" ? "dark" : "light"}
            onChange={handleIosChange}
            style={styles.picker}
            {...(minDateObj ? { minimumDate: minDateObj } : {})}
          />
        </View>
      )}
    </View>
  );
};

export default DateInput;

const stylesFn = (Colors) =>
  StyleSheet.create({
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
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    todayBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: Colors.main300,
    },
    todayBtnPressed: { opacity: 0.7 },
    todayText: { fontSize: 13, fontWeight: "500", color: Colors.main100 },
    doneText: { fontSize: 15, fontWeight: "600", color: Colors.main100 },
    picker: { alignSelf: "stretch" },
  });
