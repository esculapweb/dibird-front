import { StyleSheet, View, Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";

const Tabs = ({ tabsMode, setTabsMode }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.segment}>
      <Pressable
        style={[styles.segmentItem, tabsMode && styles.activeSegment]}
        onPress={() => setTabsMode(true)}
      >
        <Text style={[styles.segmentText, tabsMode && styles.activeText]}>
          {t("seen")}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.segmentItem, !tabsMode && styles.activeSegment]}
        onPress={() => setTabsMode(false)}
      >
        <Text style={[styles.segmentText, !tabsMode && styles.activeText]}>
          {t("not_seen")}
        </Text>
      </Pressable>
    </View>
  );
};

export default Tabs;

const stylesFn = (Colors) =>
  StyleSheet.create({
    segment: {
      flexDirection: "row",
      backgroundColor: Colors.card,
      borderRadius: 12,
      padding: 4,
      marginHorizontal: 16,
      marginTop: 8,
    },

    segmentItem: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 10,
    },

    activeSegment: {
      backgroundColor: Colors.primary,
    },

    segmentText: {
      fontSize: 14,
      color: Colors.textSecondary,
      fontWeight: "500",
    },

    activeText: {
      color: "white",
      fontWeight: "600",
    },
  });
