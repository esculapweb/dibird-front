import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";

const IconButton = ({
  tintColor,
  onPress,
  icon,
  active,
  style,
  size = 22,
  disabled,
  loading,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  if (loading)
    return (
      <View style={style}>
        <ActivityIndicator size="small" color={Colors.textMain} />
      </View>
    );

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && !disabled && styles.pressed,
        style,
        disabled && styles.disabled,
      ]}
      onPress={disabled ? undefined : onPress}
      hitSlop={8}
    >
      <Ionicons name={icon} size={size} color={tintColor} />

      {active && <View style={styles.active} />}
    </Pressable>
  );
};

export default IconButton;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      marginRight: 12,
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
