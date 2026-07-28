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
  useWindowDimensions,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { navigationRef } from "../../services/navigationRef";
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
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [payload, setPayload] = useState<SheetPayload | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isRepresentingRef = useRef(false);
  const unwatchRouteRef = useRef<(() => void) | null>(null);

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

  const stopWatchingRoute = useCallback(() => {
    unwatchRouteRef.current?.();
    unwatchRouteRef.current = null;
  }, []);

  const present = useCallback(
    (newPayload: SheetPayload) => {
      isRepresentingRef.current = true;
      setPayload(newPayload);
      setInputValue("");
      bottomSheetRef.current?.present();

      // Этот шит — один на всё приложение (services/bottomSheet.ts дёргает
      // его через модульный ref) и живёт вне навигатора, поэтому уход с
      // экрана его сам по себе не закрывает: он остаётся висеть поверх того,
      // что оказалось под ним, и съедает нажатия. Ловилось на живом
      // сценарии: PlaceEditorScreen на маунте зовёт locateMe(), при
      // отклонённой геолокации тот сразу показывает «Location unavailable»
      // (usePlaceLocation), пользователь жмёт «назад» — экран закрывается, а
      // модалка остаётся над главным экраном.
      //
      // Подписываемся здесь, а не в useEffect на маунте: GlobalBottomSheet
      // рендерится рядом с <Navigation />, и на его первом рендере
      // navigationRef ещё пуст (контейнер до готовности initialState отдаёт
      // null). К моменту показа шита экран, который его открыл, точно
      // смонтирован.
      stopWatchingRoute();
      const nav = navigationRef.current;
      if (!nav?.isReady()) return;

      const openedOn = nav.getCurrentRoute()?.key;
      unwatchRouteRef.current = nav.addListener("state", () => {
        // Сравниваем key, а не name: смена параметров того же экрана — не
        // повод закрывать шит, который этот экран и открыл.
        if (navigationRef.current?.getCurrentRoute()?.key === openedOn) return;
        stopWatchingRoute();
        bottomSheetRef.current?.dismiss();
      });
    },
    [stopWatchingRoute],
  );

  const dismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleDismiss = useCallback(() => {
    if (isRepresentingRef.current) {
      // Пере-показ: подписку уже переставил present(), гасить её нельзя.
      isRepresentingRef.current = false;
      return;
    }
    stopWatchingRoute();
    setPayload(null);
    setInputValue("");
    setIsLoading(false);
  }, [stopWatchingRoute]);

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
      maxDynamicContentSize={screenHeight * 0.9}
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
      <>
        {(menu || confirm) && (
          <BottomSheetView style={styles.outer}>
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
                      {item.icon && (
                        <View
                          style={[
                            styles.iconBox,
                            item.danger && {
                              backgroundColor: Colors.error100,
                              borderColor: Colors.error600,
                            },
                          ]}
                        >
                          <Ionicons
                            name={item.icon}
                            size={18}
                            color={
                              item.danger ? Colors.error600 : Colors.textMain
                            }
                          />
                        </View>
                      )}
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
                      <Text style={styles.inputLabel}>
                        {confirm.inputLabel}
                      </Text>
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
                  testID="bottom-sheet-confirm-button"
                >
                  {isLoading ? (
                    <ActivityIndicator
                      color={Colors.textOpposite}
                      size="small"
                    />
                  ) : (
                    <Text
                      style={[
                        styles.primaryText,
                        { color: Colors.textOpposite },
                      ]}
                    >
                      {confirm.confirmText}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={dismiss}
                  testID="bottom-sheet-cancel-button"
                >
                  <Text
                    style={[
                      styles.secondaryText,
                      { color: Colors.textSecondary },
                    ]}
                  >
                    {confirm.cancelText}
                  </Text>
                </Pressable>
              </View>
            )}
          </BottomSheetView>
        )}

        {content && (
          <>
            {content.title ? (
              <BottomSheetView style={styles.outer}>
                <View
                  style={[
                    styles.titleContainer,
                    {
                      paddingBottom: 12,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: Colors.border,
                    },
                  ]}
                >
                  <View style={styles.titleRow}>
                    <View style={styles.titleSide}>
                      {content.onReset && (
                        <Pressable
                          onPress={() => {
                            content.onReset?.();
                            dismiss();
                          }}
                          hitSlop={8}
                        >
                          <Text style={styles.resetText}>
                            {content.resetLabel ?? t("reset")}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    <Text style={styles.title}>{content.title}</Text>

                    <View style={styles.titleSide} />
                  </View>
                </View>
              </BottomSheetView>
            ) : null}
            {content.renderContent(dismiss)}
          </>
        )}
      </>
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
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: Colors.imageBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.textSecondary,
      alignItems: "center",
      justifyContent: "center",
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 8,
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

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
    },
    titleSide: {
      width: 80,
    },
    resetText: {
      fontSize: 15,
      fontWeight: "500",
      color: Colors.textSecondary,
    },

    titleContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: Colors.primary100,
      paddingHorizontal: 20,
      paddingBottom: 12,
      paddingTop: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      zIndex: 10,
    },
  });
