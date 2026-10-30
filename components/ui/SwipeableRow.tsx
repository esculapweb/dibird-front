import { ReactNode, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, PressableProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { IconType } from "../../types";

export interface SwipeAction {
  icon: IconType;
  label: string;
  // The button's fill; its icon and label are drawn in Colors.onAction, so
  // take one of the Colors.action* keys, which are chosen for that contrast.
  color: string;
  onPress: () => void;
  testID?: string;
}

export type SwipeA11yProps = Pick<
  PressableProps,
  "accessibilityActions" | "onAccessibilityAction"
>;

// Prefixed so a custom action can never shadow one of the standard names
// ("activate", "longpress", …) the platform already gives the row.
const actionName = (action: SwipeAction) =>
  `swipe:${action.testID ?? action.label}`;

/**
 * The same actions for screen-reader users, to put on the row's own
 * pressable. A swipe is not something VoiceOver/TalkBack users can do — the
 * platform offers custom actions instead (VoiceOver: swipe up/down on the
 * focused row; TalkBack: the actions menu), the way system lists expose
 * their swipe actions.
 */
export const swipeA11yProps = (actions: SwipeAction[]): SwipeA11yProps =>
  actions.length
    ? {
        accessibilityActions: actions.map((action) => ({
          name: actionName(action),
          label: action.label,
        })),
        onAccessibilityAction: (event) =>
          actions
            .find((action) => actionName(action) === event.nativeEvent.actionName)
            ?.onPress(),
      }
    : {};

const useStyles = (Colors: ThemeColors) =>
  useMemo(() => stylesFn(Colors), [Colors]);

// Only one row stays open at a time, like the system lists: opening another
// one closes the previous instead of leaving a trail of open rows behind.
let openRow: SwipeableMethods | null = null;

const ACTION_WIDTH = 80;

const SwipeableRow = ({
  leftActions = [],
  rightActions = [],
  children,
}: {
  // Revealed on the left edge by a swipe to the right.
  leftActions?: SwipeAction[];
  // Revealed on the right edge by a swipe to the left.
  rightActions?: SwipeAction[];
  children: ReactNode;
}) => {
  const { Colors } = useTheme();
  const styles = useStyles(Colors);
  const ref = useRef<SwipeableMethods>(null);
  // ReanimatedSwipeable keeps both panels mounted under the row, merely
  // transparent — so every closed row used to carry its buttons in the
  // accessibility tree (a screen reader focused invisible "Delete"s) and in
  // the view hierarchy (a Maestro text selector could hit them). Closed, a
  // panel now holds only empty placeholders; the buttons mount as the swipe
  // starts and go away once the row closes again.
  const [active, setActive] = useState(false);

  if (!leftActions.length && !rightActions.length) return <>{children}</>;

  const renderActions = (actions: SwipeAction[], side: "left" | "right") => (
    <View
      style={[
        styles.actions,
        side === "left" ? styles.actionsLeft : styles.actionsRight,
      ]}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      {actions.map((action) =>
        // The placeholder has the button's width on purpose: the library
        // measures the panel when the gesture starts — before the buttons
        // mount — and a panel measured empty would never open.
        !active ? (
          <View key={actionName(action)} style={styles.placeholder} />
        ) : (
          <Pressable
            key={actionName(action)}
            testID={action.testID}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: action.color },
              pressed && styles.pressed,
            ]}
            onPress={() => {
              // Closed first: the action may open a sheet or navigate away,
              // and the row should not stay open behind it.
              ref.current?.close();
              action.onPress();
            }}
          >
            <Ionicons
              name={action.icon}
              size={22}
              color={Colors.onAction}
              testID={action.testID ? `${action.testID}-icon` : undefined}
            />
            <Text
              style={styles.label}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {action.label}
            </Text>
          </Pressable>
        ),
      )}
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      overshootLeft={false}
      overshootRight={false}
      leftThreshold={ACTION_WIDTH / 2}
      rightThreshold={ACTION_WIDTH / 2}
      renderLeftActions={
        leftActions.length ? () => renderActions(leftActions, "left") : undefined
      }
      renderRightActions={
        rightActions.length
          ? () => renderActions(rightActions, "right")
          : undefined
      }
      onSwipeableOpenStartDrag={() => setActive(true)}
      onSwipeableWillOpen={() => {
        setActive(true);
        if (openRow && openRow !== ref.current) openRow.close();
        openRow = ref.current;
      }}
      onSwipeableClose={() => {
        setActive(false);
        if (openRow === ref.current) openRow = null;
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
};

export default SwipeableRow;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    actions: {
      flexDirection: "row",
      gap: 4,
      // Matches the cards' marginBottom, so the buttons are exactly as tall
      // as the card they sit next to.
      paddingBottom: 4,
    },
    actionsLeft: {
      paddingRight: 4,
    },
    actionsRight: {
      paddingLeft: 4,
    },
    placeholder: {
      width: ACTION_WIDTH,
    },
    action: {
      width: ACTION_WIDTH,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      gap: 4,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontSize: 11,
      fontWeight: "600",
      color: Colors.onAction,
      textAlign: "center",
    },
  });
