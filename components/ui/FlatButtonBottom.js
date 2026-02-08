import { Pressable, StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";

const FlatButtonBottom = ({ children, onPress, textColor, icon }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.flatButtonContainer,
        pressed && styles.pressed,
      ]}
    >
      <View >
        
        <Text style={[styles.buttonText, textColor && { color: textColor }]}>
          {icon && <Ionicons name={icon} size={22} color={textColor ? textColor: Colors.link} />}{" "}
          {children}
        </Text>
      </View>
    </Pressable>
  );
};

export default FlatButtonBottom;

const stylesFn = (Colors) =>
  StyleSheet.create({
    pressed: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: 16,
      textAlign: "center",
      color: Colors.link,
    },
    flatButtonContainer: {
      padding: 18,
      paddingBottom: 28,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      backgroundColor: Colors.primary100,
    },
  });
