import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Text,
  Pressable,
  StyleSheet,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { ConfirmSheetPayload } from "../../services/bottomSheet";

export interface ConfirmBottomSheetRef {
  present: (payload: ConfirmSheetPayload) => void;
  dismiss: () => void;
}

const ConfirmBottomSheet = forwardRef<ConfirmBottomSheetRef>((_, ref) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [payload, setPayload] = useState<ConfirmSheetPayload | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const data = payload?.data;

  const resolvedRequired =
    typeof payload?.requiredInput === "function"
      ? payload?.requiredInput(data)
      : (payload?.requiredInput ?? null);

  const resolvedPlaceholder =
    typeof payload?.inputPlaceholder === "function"
      ? payload?.inputPlaceholder(data)
      : (payload?.inputPlaceholder ?? resolvedRequired ?? "");

  const resolvedDescription =
    typeof payload?.description === "function"
      ? payload?.description(data)
      : payload?.description;

  const isMatch = resolvedRequired
    ? inputValue.trim().toLowerCase() === resolvedRequired.toLowerCase()
    : true;

  const isConfirmDisabled = !isMatch || isLoading;

  const present = useCallback((payload: ConfirmSheetPayload) => {
    bottomSheetRef.current?.dismiss();

    requestAnimationFrame(() => {
      setPayload(payload);
      setInputValue("");
      bottomSheetRef.current?.present();
    });
  }, []);

  const handleDismiss = useCallback(() => {
    setPayload(null);
    setInputValue("");
    setIsLoading(false);
  }, []);

  const dismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  useImperativeHandle(ref, () => ({ present, dismiss }), [present, dismiss]);

  const handleConfirm = useCallback(async () => {
    if (isConfirmDisabled) return;
    try {
      setIsLoading(true);
      await payload?.onConfirm?.(data);
      dismiss();
    } catch (e) {
      dismiss();
      setTimeout(() => payload?.onError?.(e), 400);
    } finally {
      setIsLoading(false);
    }
  }, [isConfirmDisabled, payload?.onConfirm, payload?.onError, data, dismiss]);

  const confirmBg = payload?.danger ? Colors.error600 : Colors.main100;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onDismiss={handleDismiss}
      style={{
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 10,
      }}
      backgroundStyle={{
        backgroundColor: Colors.primary100,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      }}
      handleStyle={{
        backgroundColor: "transparent",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border,
      }}
      handleIndicatorStyle={{
        backgroundColor: Colors.textSecondary,
        width: 40,
        height: 4,
      }}
    >
      <BottomSheetView style={styles.outer}>
        <View style={styles.container}>
          <Text
            style={[
              styles.title,
              payload?.danger && { color: Colors.error600 },
            ]}
          >
            {payload?.title ?? ""}
          </Text>

          {resolvedDescription ? (
            <Text style={styles.description}>{resolvedDescription}</Text>
          ) : null}

          {resolvedRequired ? (
            <View style={styles.inputBlock}>
              {payload?.inputLabel ? (
                <Text style={styles.inputLabel}>{payload?.inputLabel}</Text>
              ) : null}
              <BottomSheetTextInput
                style={[
                  styles.input,
                  {
                    borderColor:
                      inputValue.length > 0
                        ? isMatch
                          ? Colors.green
                          : Colors.error600
                        : Colors.border,
                    color: Colors.textMain,
                    backgroundColor: Colors.backgroundMain,
                  },
                ]}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder={resolvedPlaceholder}
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="default"
              />
            </View>
          ) : null}

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: confirmBg },
              isConfirmDisabled && { opacity: 0.6 },
            ]}
            onPress={handleConfirm}
            disabled={isConfirmDisabled}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textOpposite} size="small" />
            ) : (
              <Text
                style={[styles.primaryText, { color: Colors.textOpposite }]}
              >
                {payload?.confirmText ?? ""}
              </Text>
            )}
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={dismiss}>
            <Text
              style={[styles.secondaryText, { color: Colors.textSecondary }]}
            >
              {payload?.cancelText ?? ""}
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

ConfirmBottomSheet.displayName = "ConfirmBottomSheet";

export default ConfirmBottomSheet;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    outer: {
      alignItems: "center",
      backgroundColor: Colors.primary100,
    },
    container: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      paddingTop: 8,
      gap: 10,
      width: "100%",
      maxWidth: 680,
    },
    title: {
      fontSize: 17,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
    },
    description: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    inputBlock: {
      marginTop: 4,
    },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 12 : 9,
      fontSize: 15,
    },
    primaryButton: {
      marginTop: 6,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    primaryText: {
      fontWeight: "600",
      fontSize: 15,
    },
    secondaryButton: {
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryText: {
      fontWeight: "500",
      fontSize: 15,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: Colors.textMain,
      marginBottom: 6,
    },
  });
