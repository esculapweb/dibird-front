import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useTheme, ThemeColors } from "../../store/theme-context";

const StatCard = ({ value, label, onPress }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  return (
    <TouchableOpacity onPress={onPress} style={styles.statCard}>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

export default StatCard;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    statCard: {
      flex: 1,
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingVertical: 14,
      paddingHorizontal: 4,
      alignItems: "center",
    },
    statNum: {
      fontSize: 22,
      fontWeight: "600",
      color: Colors.textMain,
    },
    statLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 3,
    },
  });
