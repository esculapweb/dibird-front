import { StyleSheet, View, Text, Pressable, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { privacyLabels } from "../../util/privacyLabels";
import { StyleType } from "../../types";

interface PrivacyToggleProps {
  value: boolean;
  onChange?: (value: boolean) => void;
  style?: StyleType;
  descriptionType?: string;
  disabled?: boolean;
}

const PrivacyToggle = ({
  value,
  onChange,
  style,
  descriptionType,
  disabled,
}: PrivacyToggleProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const labels = privacyLabels(descriptionType);

  return (
    <Pressable
      style={[styles.row, style, disabled && styles.disabled]}
      disabled={!onChange || disabled}
      onPress={() => onChange && onChange(!value)}
    >
      <View style={[styles.left, onChange && { flex: 1 }]}>
        <View style={[styles.iconWrap, value && styles.iconWrapActive]}>
          <Ionicons
            name={value ? labels.private[2] : labels.public[2]}
            size={18}
            color={value ? Colors.textOpposite : Colors.textSecondary}
          />
        </View>
        <View>
          <Text style={styles.label}>
            {value ? labels.private[0] : labels.public[0]}
          </Text>
          <Text style={styles.desc}>
            {value ? labels.private[1] : labels.public[1]}
          </Text>
        </View>
      </View>
      {onChange && (
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: Colors.border, true: Colors.main100 }}
          thumbColor={Colors.primary100}
          disabled={disabled}
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
    disabled: {
      opacity: 0.35,
    }

  });
