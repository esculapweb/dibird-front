import {
  forwardRef,
  useMemo,
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

interface ConfirmBottomSheetProps {
  title: string;
  description?: string | ((data: unknown) => string);
  confirmText: string;
  cancelText: string;
  danger?: boolean;
  requiredInput?: string | ((data: unknown) => string);
  inputPlaceholder?: string | ((data: unknown) => string);
  onConfirm?: (data: unknown) => void | Promise<void>;
  onError?: (error: unknown) => void;
  inputLabel?: string;
}

export interface ConfirmBottomSheetRef {
  present: (payload: unknown) => void;
  dismiss: () => void;
}

const ConfirmBottomSheet = forwardRef<
  ConfirmBottomSheetRef,
  ConfirmBottomSheetProps
>(
  (
    {
      title,
      description,
      confirmText,
      cancelText,
      danger = false,
      requiredInput,
      inputPlaceholder,
      onConfirm,
      onError,
      inputLabel,
    },
    ref,
  ) => {
    const { Colors } = useTheme();
    const styles = stylesFn(Colors);
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [data, setData] = useState<unknown>(null);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const snapPoints = useMemo(
      () => (requiredInput ? ["55%"] : ["38%"]),
      [requiredInput],
    );

    const resolvedRequired =
      typeof requiredInput === "function"
        ? requiredInput(data)
        : (requiredInput ?? null);

    const resolvedPlaceholder =
      typeof inputPlaceholder === "function"
        ? inputPlaceholder(data)
        : (inputPlaceholder ?? resolvedRequired ?? "");

    const resolvedDescription =
      typeof description === "function" ? description(data) : description;

    const isMatch = resolvedRequired
      ? inputValue.trim().toLowerCase() === resolvedRequired.toLowerCase()
      : true;

    const isConfirmDisabled = !isMatch || isLoading;

    const present = useCallback((payload: unknown) => {
      setData(payload);
      setInputValue("");
      bottomSheetRef.current?.present();
    }, []);

    const dismiss = useCallback(() => {
      bottomSheetRef.current?.dismiss();
    }, []);

    useImperativeHandle(ref, () => ({ present, dismiss }), [present, dismiss]);

    const handleConfirm = useCallback(async () => {
      if (isConfirmDisabled) return;
      const result = onConfirm?.(data);
      if (result instanceof Promise) {
        setIsLoading(true);
        try {
          await result;
          dismiss();
        } catch (e) {
          setIsLoading(false);
          dismiss();
          setTimeout(() => onError?.(e), 400);
        }
      } else {
        dismiss();
      }
    }, [isConfirmDisabled, onConfirm, onError, data, dismiss]);

    const confirmBg = danger
      ? isConfirmDisabled
        ? Colors.primary200
        : Colors.error600
      : isConfirmDisabled
        ? Colors.primary200
        : Colors.main100;

    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        keyboardBehavior={Platform.OS === "ios" ? "extend" : "interactive"}
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        handleStyle={{ backgroundColor: Colors.primary100 }}
        handleIndicatorStyle={{
          backgroundColor: Colors.textSecondary,
          width: 40,
          height: 4,
        }}
        backgroundStyle={{ backgroundColor: Colors.primary100 }}
      >
        <BottomSheetView style={styles.container}>
          <Text style={[styles.title, danger && { color: Colors.error600 }]}>
            {title}
          </Text>

          {resolvedDescription ? (
            <Text style={styles.description}>{resolvedDescription}</Text>
          ) : null}

          {resolvedRequired ? (
            <View style={styles.inputBlock}>
              {inputLabel ? (
                <Text style={styles.inputLabel}>{inputLabel}</Text>
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
                keyboardType="email-address"
              />
            </View>
          ) : null}

          <Pressable
            style={[styles.primaryButton, { backgroundColor: confirmBg }]}
            onPress={handleConfirm}
            disabled={isConfirmDisabled}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.textOpposite} size="small" />
            ) : (
              <Text
                style={[
                  styles.primaryText,
                  { color: danger ? "#fff" : Colors.textOpposite },
                ]}
              >
                {confirmText}
              </Text>
            )}
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={dismiss}>
            <Text
              style={[styles.secondaryText, { color: Colors.textSecondary }]}
            >
              {cancelText}
            </Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

ConfirmBottomSheet.displayName = "ConfirmBottomSheet";

export default ConfirmBottomSheet;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      paddingTop: 8,
      gap: 10,
      backgroundColor: Colors.primary100,
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
