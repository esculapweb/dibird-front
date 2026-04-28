import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { IconType } from "../../types";


const MetaItem = ({ icon, text }: { icon?: IconType; text?: string | null }) => {
  if (!text) return null;
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.metaItem}>
      {icon && <Ionicons name={icon} size={11} color={Colors.statIcon} />}
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
};

export default MetaItem;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: 8,
      marginTop: 1,
    },

    metaText: {
      marginLeft: 2,
      fontSize: 11,
      color: Colors.textMain,
    },
  });
