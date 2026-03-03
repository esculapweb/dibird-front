import React from "react";
import { View, Text, StyleSheet} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";

const useStyles = (Colors) => React.useMemo(() => stylesFn(Colors), [Colors]);

const StatItem = React.memo(({ icon, txt, children, style }) => {
  const { Colors } = useTheme();
  const styles = useStyles(Colors);
  return (
    <View style={[styles.statItem, style]}>
      <View style={styles.statItemInner}>
        {icon ? (
          <Ionicons name={icon} size={16} color={Colors.textMain} />
        ) : (
          children
        )}
      </View>
      <Text style={styles.statValue}>{txt}</Text>
    </View>
  );
});

export default StatItem;


const stylesFn = (Colors) =>
  StyleSheet.create({
    statItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      backgroundColor: Colors.badgeBg,
      borderRadius: 6,
      paddingHorizontal: 4,
    },

    statItemInner: {
      width: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
    },

    statValue: {
      fontSize: 12,
      color: Colors.textMain,
      marginLeft: 2,
    },
  });
