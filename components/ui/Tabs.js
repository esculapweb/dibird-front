import { StyleSheet, View, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { useTheme } from "../../store/theme-context";

const Tabs = ({ tabsMode, setTabsMode }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.tab, tabsMode && styles.activeTab]}
        onPress={() => {
          Haptics.selectionAsync();
          setTabsMode(true);
        }}
      >
        <Ionicons
          name="eye-outline"
          size={16}
          color={tabsMode ? Colors.buttonBrightColor : Colors.textSecondary}
          style={styles.icon}
        />
        <Text style={[styles.text, tabsMode && styles.activeText]}>
          {t("seen")}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.tab, !tabsMode && styles.activeTab]}
        onPress={() => {
          Haptics.selectionAsync();
          setTabsMode(false);
        }}
      >
        <Ionicons
          name="eye-off-outline"
          size={16}
          color={!tabsMode ? Colors.buttonBrightColor : Colors.textSecondary}
          style={styles.icon}
        />
        <Text style={[styles.text, !tabsMode && styles.activeText]}>
          {t("not_seen")}
        </Text>
      </Pressable>
    </View>
  );
};

export default Tabs;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      backgroundColor: Colors.primary100,
      padding: 10,
    },

    tab: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 16,
    },

    activeTab: {
      backgroundColor: Colors.buttonBrightBg,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },

    text: {
      fontSize: 14,
      fontWeight: "500",
      color: Colors.textSecondary,
    },

    activeText: {
      fontWeight: "600",
      color: Colors.buttonBrightColor,
    },

    icon: {
      marginRight: 6,
    },
  });
