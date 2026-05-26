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
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";

import { useTheme, ThemeColors } from "../../store/theme-context";
import {
  SheetPayload,
  ConfirmSheetPayload,
  ContentSheetPayload,
  MenuSheetPayload,
} from "../../services/bottomSheet";

export interface BottomSheetRef {
  present: (payload: SheetPayload) => void;
  dismiss: () => void;
}

const UniversalBottomSheet = forwardRef<BottomSheetRef>((_, ref) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [payload, setPayload] = useState<SheetPayload | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isRepresentingRef = useRef(false);

  const confirm =
    payload?.mode === "confirm"
      ? (payload as { mode: "confirm" } & ConfirmSheetPayload)
      : null;
  const content =
    payload?.mode === "content"
      ? (payload as { mode: "content" } & ContentSheetPayload)
      : null;
  const menu =
    payload?.mode === "menu"
      ? (payload as { mode: "menu" } & MenuSheetPayload)
      : null;

  const data = confirm?.data;

  const resolvedRequired =
    typeof confirm?.requiredInput === "function"
      ? confirm.requiredInput(data)
      : (confirm?.requiredInput ?? null);

  const resolvedPlaceholder =
    typeof confirm?.inputPlaceholder === "function"
      ? confirm.inputPlaceholder(data)
      : (confirm?.inputPlaceholder ?? resolvedRequired ?? "");

  const resolvedDescription =
    typeof confirm?.description === "function"
      ? confirm.description(data)
      : confirm?.description;

  const isMatch = resolvedRequired
    ? inputValue.trim().toLowerCase() === resolvedRequired.toLowerCase()
    : true;

  const isConfirmDisabled = !isMatch || isLoading;
  const confirmBg = confirm?.danger ? Colors.error600 : Colors.main100;

  const present = useCallback((newPayload: SheetPayload) => {
    isRepresentingRef.current = true;
    setPayload(newPayload);
    setInputValue("");
    bottomSheetRef.current?.present();
  }, []);

  const dismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleDismiss = useCallback(() => {
    if (isRepresentingRef.current) {
      isRepresentingRef.current = false;
      return;
    }
    setPayload(null);
    setInputValue("");
    setIsLoading(false);
  }, []);

  useImperativeHandle(ref, () => ({ present, dismiss }), [present, dismiss]);

  const handleConfirm = useCallback(async () => {
    if (!confirm || isConfirmDisabled) return;
    try {
      setIsLoading(true);
      await confirm.onConfirm?.(data);
      dismiss();
    } catch (e) {
      dismiss();
      setTimeout(() => confirm.onError?.(e), 400);
    } finally {
      setIsLoading(false);
    }
  }, [confirm, isConfirmDisabled, data, dismiss]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      stackBehavior="replace"
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onDismiss={handleDismiss}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          pressBehavior="close"
        />
      )}
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
        {/* ── Menu mode ────────────────────────────────────── */}
        {menu && (
          <View style={styles.container}>
            {menu.title ? (
              <Text style={styles.menuTitle}>{menu.title}</Text>
            ) : null}
            {menu.items.map((item, i) => (
              <View key={i}>
                {i > 0 && <View style={styles.divider} />}
                <Pressable
                  style={styles.menuRow}
                  onPress={() => {
                    item.onPress();
                  }}
                >
                  <Text
                    style={[
                      styles.menuLabel,
                      item.danger && { color: Colors.error600 },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* ── Content mode ─────────────────────────────────── */}
        {content && (
          <View style={styles.container}>
            {content.title ? (
              <Text style={styles.title}>{content.title}</Text>
            ) : null}
            {content.renderContent(dismiss)}
          </View>
        )}

        {/* ── Confirm mode ─────────────────────────────────── */}
        {confirm && (
          <View style={styles.container}>
            <Text
              style={[
                styles.title,
                confirm.danger && { color: Colors.error600 },
              ]}
            >
              {confirm.title}
            </Text>

            {resolvedDescription ? (
              <Text style={styles.description}>{resolvedDescription}</Text>
            ) : null}

            {resolvedRequired ? (
              <View style={styles.inputBlock}>
                {confirm.inputLabel ? (
                  <Text style={styles.inputLabel}>{confirm.inputLabel}</Text>
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
                  {confirm.confirmText}
                </Text>
              )}
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={dismiss}>
              <Text
                style={[styles.secondaryText, { color: Colors.textSecondary }]}
              >
                {confirm.cancelText}
              </Text>
            </Pressable>
          </View>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

UniversalBottomSheet.displayName = "UniversalBottomSheet";
export default UniversalBottomSheet;

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
    menuTitle: {
      fontSize: 13,
      color: Colors.textSecondary,
      textAlign: "center",
      paddingVertical: 4,
    },
    menuRow: {
      paddingVertical: 14,
      alignItems: "center",
    },
    menuLabel: {
      fontSize: 16,
      fontWeight: "500",
      color: Colors.textMain,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
    },
    description: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    inputBlock: { marginTop: 4 },
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
    primaryText: { fontWeight: "600", fontSize: 15 },
    secondaryButton: { paddingVertical: 12, alignItems: "center" },
    secondaryText: { fontWeight: "500", fontSize: 15 },
    inputLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: Colors.textMain,
      marginBottom: 6,
    },
  });
