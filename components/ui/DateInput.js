import { useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { BottomSheetModal, BottomSheetBackdrop } from "@gorhom/bottom-sheet";

import { useTheme } from "../../store/theme-context";

const getTodayEnd = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

const formatDate = (date) => {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split("T")[0];
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
  const sheetRef = useRef(null);
  const snapPoints = useMemo(() => ["45%"], []);

  const openSheet = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  const closeSheet = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const handleChange = (event, selectedDate) => {
    if (event.type === "set" && selectedDate) {
      onChange(selectedDate);

      if (Platform.OS === "ios") {
        setTimeout(closeSheet, 250);
      }
    }

    if (Platform.OS === "android") {
      closeSheet();
    }
  };

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.4}
      />
    ),
    []
  );

  return (
    <>
      <View style={styles.wrapper}>
        {label && <Text style={styles.label}>{label}</Text>}

        <Pressable
          onPress={openSheet}
          style={[styles.input, error && styles.errorBorder]}
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

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: Colors.primary100 }}
        handleIndicatorStyle={{ backgroundColor: Colors.border }}
      >
        <View style={styles.sheetContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {label || t("select_date")}
            </Text>

            <Pressable onPress={closeSheet}>
              <Ionicons name="close" size={24} color={Colors.textMain} />
            </Pressable>
          </View>

          <Pressable
            style={styles.todayBtn}
            onPress={() => {
              onChange(new Date());
              closeSheet();
            }}
          >
            <Text style={styles.todayText}>{t("today")}</Text>
          </Pressable>

          <DateTimePicker
            value={value || new Date()}
            mode="date"
            maximumDate={today}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            themeVariant={theme === "dark" ? "dark" : "light"}
            onChange={handleChange}
            {...(minimumDate ? { minimumDate } : {})}
          />
        </View>
      </BottomSheetModal>
    </>
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

    text: { fontSize: 16, color: Colors.textMain },
    placeholder: { color: Colors.textSecondary },

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

    sheetContent: {
      paddingHorizontal: 16,
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },

    headerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
    },

    todayBtn: {
      alignSelf: "flex-start",
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: Colors.primary200,
      marginBottom: 8,
    },

    todayText: {
      color: Colors.textMain,
      fontWeight: "500",
    },
  });