import { StyleSheet, View, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../store/theme-context";

const Tabs = ({ tabsMode, setTabsMode }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, insets);

  const TAB_OPTIONS = [
    {
      value: "seen",
      icon: "eye",
      iconInactive: "eye-outline",
      labelKey: t("seen"),
    },
    {
      value: "all",
      icon: "apps",
      iconInactive: "apps-outline",
      labelKey: t("all"),
    },
    {
      value: "unseen",
      icon: "eye-off",
      iconInactive: "eye-off-outline",
      labelKey: t("not_seen"),
    },
  ];

  const translations = {};

  return (
    <View style={styles.container}>
      {TAB_OPTIONS.map(({ value, icon, iconInactive, labelKey }) => {
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
              size={24}
              color={isActive ? Colors.tabActiveColor : Colors.textSecondary}
            />
            <Text style={[styles.text, isActive && styles.activeText]}>
              {t(labelKey)}
            </Text>
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
      gap: 3,
      borderTopWidth: 2,
      borderTopColor: "transparent",
      paddingTop: 6,
    },
    activeTab: {
      borderTopColor: Colors.tabActiveColor,
    },
    text: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    activeText: {
      color: Colors.tabActiveColor,
    },
  });
