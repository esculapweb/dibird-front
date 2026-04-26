import { StyleSheet, View, Text, Pressable, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { privacyLabels } from "../../util/privacyLabels";

const PrivacyToggle = ({ value, onChange, style, gender, labelAdditional }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();

  const labels = privacyLabels(gender);

  return (
    <Pressable
      style={[styles.row, style]}
      disabled={!onChange}
      onPress={() => onChange && onChange(!value)}
    >
      <View style={[styles.left, onChange && {flex: 1}]}>
        <View style={[styles.iconWrap, value && styles.iconWrapActive]}>
          <Ionicons
            name={value ? "lock-closed" : "globe-outline"}
            size={18}
            color={value ? Colors.textOpposite : Colors.textSecondary}
          />
        </View>
        <View>
          <Text style={styles.label}>{labelAdditional}{value ? labels.private : labels.public}</Text>
          <Text style={styles.desc}>
            {value ? t("visible_only_to_you") : t("visible_to_everyone")}
          </Text>
        </View>
      </View>
      {onChange && (
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: Colors.border, true: Colors.main100 }}
          thumbColor={Colors.primary100}
        />
      )}
    </Pressable>
  );
};

export default PrivacyToggle;

const stylesFn = (Colors: ThemeColors) =>
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
      backgroundColor: Colors.main100,
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
