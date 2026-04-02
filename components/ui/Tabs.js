import { StyleSheet, View, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../store/theme-context";

const Tabs = ({ tabOptions, tabsMode, setTabsMode }) => {
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, insets);

  return (
    <View style={styles.container}>
      {tabOptions.map(({ value, icon, iconInactive, labelKey, count }) => {
        const isActive = tabsMode === value;
        return (
          <Pressable
            key={value}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => {
              Haptics.selectionAsync();
              setTabsMode(value);
            }}
          >
            <Ionicons
              name={isActive ? icon : iconInactive}
              size={22}
              color={isActive ? Colors.tabActiveColor : Colors.textSecondary}
            />
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {labelKey}
            </Text>
            {count != null && (
              <View style={[styles.badge, isActive && styles.activeBadge]}>
                <Text style={[styles.badgeText, isActive && styles.activeBadgeText]}>
                  {count > 999 ? "999+" : count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
};

export default Tabs;

const stylesFn = (Colors, insets) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      backgroundColor: Colors.primary100,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.tabBorder,
      paddingBottom: insets.bottom,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 6,
      paddingBottom: 4,
      gap: 2,
      borderTopWidth: 2,
      borderTopColor: "transparent",
    },
    activeTab: {
      borderTopColor: Colors.tabActiveColor,
    },
    label: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    activeLabel: {
      color: Colors.tabActiveColor,
      fontWeight: "500",
    },
    badge: {
      marginTop: 2,
      minWidth: 28,
      height: 16,
      borderRadius: 8,
      backgroundColor: Colors.textSecondary + "22",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    activeBadge: {
      backgroundColor: Colors.tabActiveColor + "22",
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "500",
      color: Colors.textSecondary,
      lineHeight: 14,
    },
    activeBadgeText: {
      color: Colors.tabActiveColor,
    },
  });
