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

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const formatDate = (date, locale = "ru") => {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getTodayEnd = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

const DateInput = ({
  label,
  value,
  onChange,
  placeholder = "Select date",
  error,
  minimumDate,
  allowClear = true,
  disabled = false,
  style
}) => {
  const { t, i18n } = useTranslation();
  const { Colors, theme } = useTheme();
  const styles = stylesFn(Colors);

  const today = getTodayEnd();

  // Android: controls whether the native dialog is shown
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);

  // iOS: controls the inline panel
  const [iosOpen, setIosOpen] = useState(false);
  // iOS: temp date — applied only on "Done"
  const [tempDate, setTempDate] = useState(null);

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
    [scaleAnim]
  );

  const handleFieldPress = useCallback(() => {
    if (disabled) return;
    Haptics.selectionAsync();

    if (Platform.OS === "android") {
      setAndroidPickerOpen(true);
    } else {
      setTempDate(value ? new Date(value) : new Date());
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIosOpen((prev) => !prev);
    }
  }, [disabled, value]);

  // ── Android ────────────────────────────────────────────────────────────────
  const handleAndroidChange = useCallback(
    (event, selectedDate) => {
      // Always hide the picker first — no state that triggers re-render of panel
      setAndroidPickerOpen(false);
      if (event.type === "set" && selectedDate) {
        onChange(selectedDate);
        Haptics.selectionAsync();
      }
    },
    [onChange]
  );

  // ── iOS ───────────────────────────────────────────────────────────────────
  const handleIosChange = useCallback((_event, selectedDate) => {
    if (selectedDate) setTempDate(selectedDate);
  }, []);

  const handleIosConfirm = useCallback(() => {
    if (tempDate) {
      onChange(tempDate);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIosOpen(false);
  }, [tempDate, onChange]);

  const handleIosCancel = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIosOpen(false);
  }, []);

  const handleToday = useCallback(() => {
    const now = new Date();
    if (Platform.OS === "ios") {
      setTempDate(now);
    } else {
      onChange(now);
      Haptics.selectionAsync();
      setAndroidPickerOpen(false);
    }
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onChange]);

  const isOpen = Platform.OS === "ios" ? iosOpen : false;

  return (
    <View style={[styles.wrapper && style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Field row */}
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

      {/* Android: native dialog — rendered outside of any panel, no extra UI */}
      {Platform.OS === "android" && androidPickerOpen && (
        <DateTimePicker
          value={value || new Date()}
          mode="date"
          display="default"
          maximumDate={today}
          onChange={handleAndroidChange}
          {...(minimumDate ? { minimumDate } : {})}
        />
      )}

      {/* iOS: inline expandable panel */}
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
              <Ionicons name="today-outline" size={14} color={Colors.textMain} />
              <Text style={styles.todayText}>{t("today")}</Text>
            </Pressable>

            <View style={styles.iosActions}>
              <Pressable onPress={handleIosCancel} hitSlop={8}>
                <Text style={styles.cancelText}>{t("cancel")}</Text>
              </Pressable>
              <Pressable onPress={handleIosConfirm} hitSlop={8}>
                <Text style={styles.doneText}>{t("done")}</Text>
              </Pressable>
            </View>
          </View>

          <DateTimePicker
            value={tempDate || value || new Date()}
            mode="date"
            display="spinner"
            maximumDate={today}
            themeVariant={theme === "dark" ? "dark" : "light"}
            onChange={handleIosChange}
            style={styles.picker}
            {...(minimumDate ? { minimumDate } : {})}
          />
        </View>
      )}
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

    inputPressed: {
      backgroundColor: Colors.primary200,
    },

    inputDisabled: {
      opacity: 0.5,
    },

    text: { fontSize: 16, color: Colors.textMain },
    placeholder: { color: Colors.textSecondary },
    textDisabled: { color: Colors.textSecondary },

    icons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    error: {
      marginTop: 4,
      fontSize: 12,
      color: Colors.error500,
    },

    errorBorder: {
      borderColor: Colors.error500,
    },

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
      backgroundColor: Colors.primary200,
    },

    todayBtnPressed: { opacity: 0.7 },

    todayText: {
      fontSize: 13,
      fontWeight: "500",
      color: Colors.textMain,
    },

    iosActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },

    cancelText: {
      fontSize: 15,
      color: Colors.textSecondary,
    },

    doneText: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.link,
    },

    picker: {
      alignSelf: "stretch",
    },
  });
