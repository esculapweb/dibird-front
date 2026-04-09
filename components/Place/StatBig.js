import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";
import { BirdSVG } from "../ui/Svgs";

export const StatBig = ({ icon, value, label, onPress, bird }) => {
  const { Colors } = useTheme();
  const styles = makeStyles(Colors);

  return (
    <Pressable style={styles.container} onPress={onPress}>
      
      <Text style={styles.value}>{value}</Text>
      <View style={styles.iconWrapper}>
        {bird ? (
          <BirdSVG size={24} color={Colors.textMain} />
        ) : icon ? (
          <Ionicons name={icon} size={24} color={Colors.textMain} />
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
};

const makeStyles = (Colors) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      marginHorizontal: 8,
      gap: 8,
    },
    iconWrapper: {
      justifyContent: "center",
      alignItems: "center",
    },
    value: {
      fontSize: 24,
      fontWeight: "700",
      color: Colors.main100,
    },
    label: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
  });