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

type RouteTree = { routes?: { key?: string; state?: RouteTree }[] };

// getRootState() returns the root navigator only: the screens of nested ones
// (drawer → native-stack) live in route.state, so the whole tree is walked.
const hasRouteKey = (state: RouteTree | undefined, key: string): boolean =>
  !!state?.routes?.some(
    (route) => route.key === key || hasRouteKey(route.state, key),
  );

const UniversalBottomSheet = forwardRef<BottomSheetRef>((_, ref) => {
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [payload, setPayload] = useState<SheetPayload | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isOpenRef = useRef(false);
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
      // Optimistically, without waiting for the library's own onChange: a
      // dismiss() arriving in the same tick has to find the sheet open, or it
      // would be dropped by the guard below and leave the sheet hanging.
      isOpenRef.current = true;
      setPayload(newPayload);
      setInputValue("");
      bottomSheetRef.current?.present();

      // This sheet is a single one for the whole app (services/bottomSheet.ts
      // drives it through a module-level ref) and lives outside the navigator,
      // so leaving a screen does not close it by itself: it stays on top of
      // whatever ends up underneath and swallows taps. Caught in a real
      // scenario: PlaceEditorScreen calls locateMe() on mount, with location
      // declined it immediately shows "Location unavailable"
      // (usePlaceLocation), the user presses "back" — the screen closes and the
      // modal stays above the main screen.
      //
      // The subscription is set up here rather than in a mount useEffect:
      // GlobalBottomSheet renders next to <Navigation />, and on its first
      // render navigationRef is still empty (the container returns null until
      // initialState is ready). By the time the sheet is shown, the screen that
      // opened it is certainly mounted.
      stopWatchingRoute();
      const nav = navigationRef.current;
      if (!nav?.isReady()) return;

      const openedOn = nav.getCurrentRoute()?.key;
      if (!openedOn) return;

      unwatchRouteRef.current = nav.addListener("state", () => {
        // The criterion is "the owner screen disappeared from the stack", not
        // "focus left it". Closing on focus would dismiss the sheet on a deeper
        // navigation too and — worse — on a capture miss: if present() is called
        // while navigation is still in transit, the previous screen is recorded
        // as the owner, and the very first state event would dismiss the sheet
        // that just opened (the symptom is indistinguishable from "the sheet did
        // not open"). Checking presence in the tree is not subject to that race
        // by construction: a mis-captured owner stays in the stack anyway.
        // The sheet is already closed (confirm/cancel/swipe) — dismissing it
        // again is not allowed: a spurious dismiss() breaks BottomSheetModal,
        // and the next present() silently shows nothing.
        if (!isOpenRef.current) {
          stopWatchingRoute();
          return;
        }
        const root = navigationRef.current?.getRootState() as
          | RouteTree
          | undefined;
        if (!root || hasRouteKey(root, openedOn)) return;
        stopWatchingRoute();
        bottomSheetRef.current?.dismiss();
      });
    },
    [stopWatchingRoute],
  );

  const dismiss = useCallback(() => {
    // A dismiss() on a sheet that is not open must never reach the library.
    // BottomSheetModal answers that one by unmounting the node and the portal
    // under its key (handleDismiss → unmount → unmountSheet/unmountPortal),
    // which races the portal the next present() registers under the very same
    // key — and past that point present() shows nothing at all. The sheet is a
    // single global one, so that is every sheet in the app dead until restart.
    // Callers cannot keep track themselves: BottomSheet.hide() fires from
    // places that do not know whether anything is open (SettingsScreen before
    // the logout, the menu rows in StatScreen/BirdOfTheDay that navigate
    // first), and the route watcher below can get there ahead of them.
    if (!isOpenRef.current) return;

    // Dismiss it ourselves — there is nothing left for the watcher to do here.
    // Waiting for onDismiss is not an option: it arrives when the closing
    // animation finishes, while the navigation event (the screen leaves right
    // after the deletion is confirmed) gets there earlier, and the watcher sends
    // a second dismiss() on a closing sheet — after that BottomSheetModal never
    // opens again.
    isOpenRef.current = false;
    stopWatchingRoute();
    bottomSheetRef.current?.dismiss();
  }, [stopWatchingRoute]);

  // The sheet also closes without us — a pan down, a tap on the backdrop — and
  // index -1 is the library saying so, ahead of onDismiss. Keeping the flag
  // honest from its own events rather than from our calls alone is what stops a
  // later dismiss() from reaching a sheet that is already closed.
  const handleChange = useCallback((index: number) => {
    isOpenRef.current = index >= 0;
  }, []);

  // Every onDismiss that gets here is a real close. This used to absorb the
  // first one after a present() over an open sheet, taking it for the echo of
  // stackBehavior="replace" — but that echo cannot happen with a single
  // BottomSheetModal in the tree (GlobalBottomSheet is the only one): "replace"
  // dismisses *other* modals in the provider's queue, and presenting over the
  // open one early-exits there ("already presented and at the top") and merely
  // re-snaps it. So the guard had no echo to absorb and swallowed the next
  // genuine close instead: isOpenRef stayed true on a closed sheet, the route
  // subscription stayed alive, and leaving the screen sent exactly the fatal
  // second dismiss() described above.
  const handleDismiss = useCallback(() => {
    isOpenRef.current = false;
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
      onChange={handleChange}
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
                      testID={item.testID}
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
