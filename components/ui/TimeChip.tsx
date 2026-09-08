import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { BottomSheetView } from "@gorhom/bottom-sheet";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { BottomSheet } from "../../services/bottomSheet";
import {
  formatTimeString,
  timeStringToDate,
  dateToTimeString,
} from "../../util/timeHelpers";

// The spinner scrolls vertically inside a sheet that pans vertically too. The
// payload turns the sheet's own content gesture off (disableContentPanning),
// and this keeps the wheel from being cancelled by anything above it.
const nativeGesture = Gesture.Native().shouldCancelWhenOutside(false);

// iOS spinners have no intrinsic height inside a dynamically sized sheet — the
// standard picker height has to be stated or the wheel collapses to nothing.
const PICKER_HEIGHT = 216;

const TimeSheetContent = ({
  initial,
  onChange,
  dismiss,
}: {
  initial: string | null;
  onChange: (value: string | null) => void;
  dismiss: () => void;
}) => {
  const { t } = useTranslation();
  const { Colors, theme } = useTheme();
  const styles = sheetStylesFn(Colors);

  // A draft: nothing reaches the form until "Done", so opening the sheet over
  // an empty field and swiping it away leaves the field empty. Time is
  // optional here and must never be filled in by merely looking at it.
  const [draft, setDraft] = useState(() =>
    timeStringToDate(initial ?? undefined),
  );

  const handleNow = useCallback(() => {
    setDraft(new Date());
    Haptics.selectionAsync();
  }, []);

  const handleClear = useCallback(() => {
    onChange(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dismiss();
  }, [onChange, dismiss]);

  const handleDone = useCallback(() => {
    onChange(dateToTimeString(draft));
    dismiss();
  }, [draft, onChange, dismiss]);

  return (
    <BottomSheetView style={styles.container}>
      {/* The sheet's own `title` payload is deliberately not used: it renders
          as a second BottomSheetView, and with enableDynamicSizing both nodes
          write the same contentHeight — last writer wins, and the sheet opens
          too short to show its own first row (see TaxonFilterSheet, which hit
          this before). One measured node, title included. */}
      <Text style={styles.title}>{t("select_time")}</Text>

      <View style={styles.actions}>
        <Pressable
          onPress={handleNow}
          style={({ pressed }) => [styles.nowBtn, pressed && styles.pressed]}
          testID="time-sheet-now"
        >
          <Ionicons name="time-outline" size={14} color={Colors.main100} />
          <Text style={styles.nowText}>{t("now")}</Text>
        </Pressable>

        {initial ? (
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [
              styles.clearBtn,
              pressed && styles.pressed,
            ]}
            testID="time-sheet-clear"
          >
            <Text style={styles.clearText}>{t("clear_time")}</Text>
          </Pressable>
        ) : null}
      </View>

      <GestureDetector gesture={nativeGesture}>
        <DateTimePicker
          value={draft}
          mode="time"
          is24Hour
          display="spinner"
          themeVariant={theme === "dark" ? "dark" : "light"}
          onChange={(_event: DateTimePickerEvent, selected?: Date) =>
            selected && setDraft(selected)
          }
          style={styles.picker}
        />
      </GestureDetector>

      <Pressable
        onPress={handleDone}
        style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}
        testID="time-sheet-done"
      >
        <Text style={styles.doneText}>{t("done")}</Text>
      </Pressable>
    </BottomSheetView>
  );
};

interface TimeChipProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  testID?: string;
}

const TimeChip = ({
  value,
  onChange,
  disabled = false,
  testID,
}: TimeChipProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  // Android has no inline picker: the component is a dialog, so it cannot live
  // inside the sheet the way the iOS spinner does. The native dialog is opened
  // straight from the chip instead.
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.selectionAsync();

    if (Platform.OS === "android") {
      setAndroidPickerOpen(true);
      return;
    }

    BottomSheet.showContent({
      disableContentPanning: true,
      renderContent: (dismiss: () => void) => (
        <TimeSheetContent
          initial={value}
          onChange={onChange}
          dismiss={dismiss}
        />
      ),
    });
  }, [disabled, value, onChange, t]);

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

  const handleClear = useCallback(() => {
    onChange(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onChange]);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        testID={testID}
        style={({ pressed }) => [
          styles.chip,
          value ? styles.chipFilled : styles.chipEmpty,
          disabled && styles.chipDisabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Ionicons
          name={value ? "time" : "time-outline"}
          size={15}
          color={value ? Colors.main100 : Colors.textSecondary}
        />
        <Text
          style={[styles.text, !value && styles.placeholder]}
          numberOfLines={1}
        >
          {value ? formatTimeString(value) : t("add_time")}
        </Text>
        {value && !disabled ? (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            testID={testID ? `${testID}-clear` : undefined}
          >
            <Ionicons
              name="close-circle"
              size={16}
              color={Colors.dropdownIcon}
            />
          </Pressable>
        ) : null}
      </Pressable>

      {Platform.OS === "android" && androidPickerOpen && (
        <DateTimePicker
          value={timeStringToDate(value ?? undefined)}
          mode="time"
          is24Hour
          display="default"
          onChange={handleAndroidChange}
        />
      )}
    </View>
  );
};

export default TimeChip;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: { justifyContent: "center" },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 28,
      paddingHorizontal: 8,
      borderRadius: 14,
    },
    chipFilled: { backgroundColor: Colors.main300 },
    // No fill and a dashed outline: the field is optional and has to read as an
    // invitation rather than as a value someone already set.
    chipEmpty: {
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: Colors.border,
    },
    chipDisabled: { opacity: 0.5 },
    pressed: { opacity: 0.7 },
    text: { fontSize: 14, fontWeight: "500", color: Colors.main100 },
    placeholder: { fontWeight: "400", color: Colors.textSecondary },
  });

const sheetStylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 24,
      backgroundColor: Colors.primary100,
    },
    title: {
      fontSize: 17,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
      paddingBottom: 12,
      marginBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 32,
    },
    nowBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: Colors.main300,
    },
    nowText: { fontSize: 13, fontWeight: "500", color: Colors.main100 },
    clearBtn: { paddingVertical: 6, paddingHorizontal: 10 },
    clearText: { fontSize: 14, color: Colors.error600 },
    picker: { alignSelf: "stretch", height: PICKER_HEIGHT },
    doneBtn: {
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: Colors.main100,
    },
    doneText: { fontSize: 16, fontWeight: "600", color: Colors.textOpposite },
    pressed: { opacity: 0.7 },
  });
