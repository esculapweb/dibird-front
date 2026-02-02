import { View, Text, StyleSheet } from "react-native";

import { useTheme } from "../../store/theme-context";


export const MetaRow = ({ label, value }) => {
  const { Colors } = useTheme();
  const styles = makeStyles(Colors);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const makeStyles = (Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: Colors.divider,
    },
    label: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    value: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
    },
  });