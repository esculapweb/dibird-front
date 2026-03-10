import { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../store/theme-context";

// Нужно для Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Section = ({
  title,
  required,
  children,
  hint,
  style,
  collapsed: initialCollapsed = false,
  collapsible = false,
}) => {
  const { Colors } = useTheme();
  const styles = sectionFn(Colors);

  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsCollapsed((prev) => !prev);
  };

  const isCollapsible = collapsible || initialCollapsed;

  return (
    <View style={[styles.section, style]}>
      {title && (
        <TouchableOpacity
          style={[styles.sectionHeader, !isCollapsed && { marginBottom: 12 }]}
          onPress={isCollapsible ? handleToggle : undefined}
          activeOpacity={isCollapsible ? 0.7 : 1}
          hitSlop={16}
        >
          <Text style={styles.sectionTitle}>
            {title}
            {required && <Text style={styles.required}> *</Text>}
          </Text>

          <View style={styles.hintRow}>
            {hint && <Text style={styles.hint}>{hint}</Text>}
            {isCollapsible && (
              <Ionicons
                name={isCollapsed ? "chevron-down" : "chevron-up"}
                size={14}
                color={Colors.textSecondary}
                style={styles.chevron}
              />
            )}
          </View>
        </TouchableOpacity>
      )}

      {!isCollapsed && children}
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
    hintRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    hint: {
      fontSize: 12,
      color: Colors.textSecondary,
      fontStyle: "italic",
    },
    chevron: {
      marginLeft: 2,
    },
  });
