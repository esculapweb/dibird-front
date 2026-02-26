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
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { useTheme } from "../../store/theme-context";

const formatTime = (date) => {
  if (!date) return "";
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
};

const TimeInput = ({
  label,
  value,
  onChange,
  placeholder = "Select time",
  error,
  allowClear = true,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { Colors, theme } = useTheme();
  const styles = stylesFn(Colors);

  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);
  const [tempDate, setTempDate] = useState(() => {
    const d = value || new Date();
    return new Date(2000, 0, 1, d.getHours(), d.getMinutes());
  });

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
      const d = value || new Date();
      setTempDate(new Date(2000, 0, 1, d.getHours(), d.getMinutes()));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIosOpen((prev) => !prev);
    }

  }, [disabled, value]);

  const handleAndroidChange = useCallback(
    (event, selectedDate) => {
      setAndroidPickerOpen(false);
      if (event.type === "set" && selectedDate) {
        onChange(selectedDate);
        Haptics.selectionAsync();
      }
    },
    [onChange]
  );

  const handleIosChange = useCallback((_event, selectedDate) => {
    if (selectedDate) setTempDate(selectedDate);
  }, []);

  const handleIosConfirm = useCallback(() => {
    onChange(tempDate);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIosOpen(false);
  }, [tempDate, onChange]);

  const handleIosCancel = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIosOpen(false);
  }, []);

  const handleClear = useCallback(() => {
    onChange(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onChange]);

  const isOpen = Platform.OS === "ios" ? iosOpen : false;

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
              !value && styles.placeholder,
              disabled && styles.textDisabled,
            ]}
          >
            {value ? formatTime(value) : placeholder}
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
              name={isOpen ? "chevron-up" : "time"}
              size={20}
              color={Colors.textSecondary}
            />
          </View>
        </Pressable>
      </Animated.View>

      {error && !isOpen && <Text style={styles.error}>{error}</Text>}

      {/* Android: native dialog */}
      {Platform.OS === "android" && androidPickerOpen && (
        <DateTimePicker
          value={value || new Date()}
          mode="time"
          is24Hour
          display="default"
          onChange={handleAndroidChange}
        />
      )}

      {/* iOS: inline panel */}
      {Platform.OS === "ios" && iosOpen && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Pressable onPress={handleIosCancel} hitSlop={8}>
              <Text style={styles.cancelText}>{t("cancel")}</Text>
            </Pressable>
            <Pressable onPress={handleIosConfirm} hitSlop={8}>
              <Text style={styles.doneText}>{t("done")}</Text>
            </Pressable>
          </View>

          <DateTimePicker
            value={tempDate || value || new Date()}
            mode="time"
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
