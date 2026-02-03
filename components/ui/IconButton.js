import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";

const IconButton = ({ tintColor, onPress, icon, active, style, size=22, disabled }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && !disabled && styles.pressed,
        style,
        disabled &&  styles.disabled
      ]}
      onPress={disabled ? undefined : onPress}
      hitSlop={12}

    >
      <Ionicons name={icon} size={size} color={tintColor} />

      {active && <View style={styles.dot} />}
    </Pressable>
  );
};

export default IconButton;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      marginRight: 12,
    },
    dot: {
      position: "absolute",
      top: -2,
      right: -2,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Colors.logoAccent,
      borderWidth: 1,
      borderColor: Colors.dotBorder,
    },
    pressed: {
      opacity: 0.7,
    },
    disabled: {
      opacity: 0.4,
    },
  });
