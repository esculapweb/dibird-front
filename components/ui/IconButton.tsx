import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { IconButtonProps } from "../../types";

const IconButton = ({
  tintColor,
  onPress,
  icon,
  active,
  style,
  size = 22,
  disabled,
  loading,
  testID,
}: IconButtonProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  if (loading)
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color={Colors.textMain} />
      </View>
    );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      onPress={disabled ? undefined : onPress}
      hitSlop={4}
      testID={testID}
    >
      <Ionicons name={icon} size={size} color={tintColor ?? Colors.textMain} />

      {active && <View style={styles.active} />}
    </Pressable>
  );
};

export default IconButton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: 34,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    active: {
      position: "absolute",
      top: 0,
      right: 2,
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
