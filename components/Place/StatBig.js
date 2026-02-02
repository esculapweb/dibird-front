import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";
import { BirdSVG } from "../ui/Svgs";

export const StatBig = ({ icon, value, label, onPress, bird }) => {
  const { Colors } = useTheme();
  const styles = makeStyles(Colors);

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.iconWrapper}>
        {bird ? (
          <BirdSVG size={28} color={Colors.textMain} />
        ) : icon ? (
          <Ionicons name={icon} size={28} color={Colors.textMain} />
        ) : null}
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
};

const makeStyles = (Colors) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      marginHorizontal: 8,
    },
    iconWrapper: {
      width: 48,
      height: 48,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 4,
    },
    value: {
      fontSize: 16,
      fontWeight: "700",
      color: Colors.textMain,
    },
    label: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
  });