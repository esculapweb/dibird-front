import { StyleSheet, View, Text } from "react-native";

import { useTheme } from "../../store/theme-context";

const Section = ({ title, required, children, hint }) => {
  const { Colors } = useTheme();
  const styles = sectionFn(Colors);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {title}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
};

export default Section;

const sectionFn = (Colors) =>
  StyleSheet.create({
    section: {
      marginBottom: 8,
      backgroundColor: Colors.primary100,
      borderRadius: 14,
      padding: 16,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: Colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    required: {
      color: Colors.error500,
    },
    hint: {
      fontSize: 12,
      color: Colors.textSecondary,
      fontStyle: "italic",
    },
  });
