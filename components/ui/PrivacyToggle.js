import { StyleSheet, View, Text, Pressable, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";

const PrivacyToggle = ({ value, onChange, style }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  
  return (
    <Pressable style={[styles.row, style]} onPress={() => onChange(!value)}>
      <View style={styles.left}>
        <View style={[styles.iconWrap, value && styles.iconWrapActive]}>
          <Ionicons
            name={value ? "lock-closed" : "globe-outline"}
            size={18}
            color={value ? Colors.buttonPrimaryText : Colors.textSecondary}
          />
        </View>
        <View>
          <Text style={styles.label}>{value ? t("private") : t("public")}</Text>
          <Text style={styles.desc}>
            {value ? t("visible_only_to_you") : t("visible_to_everyone")}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.accent }}
        thumbColor={Colors.primary100}
      />
    </Pressable>
  );
};

export default PrivacyToggle;

const stylesFn = (Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: Colors.primary200,
      justifyContent: "center",
      alignItems: "center",
    },
    iconWrapActive: {
      backgroundColor: Colors.accent,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
    },
    desc: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 1,
    },
  });
