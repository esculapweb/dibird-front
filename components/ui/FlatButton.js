import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../store/theme-context";

const FlatButton = ({ children, onPress }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View>
        <Text style={styles.buttonText}>{children}</Text>
      </View>
    </Pressable>
  );
};

export default FlatButton;

const stylesFn = (Colors) =>
  StyleSheet.create({
    button: {
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    pressed: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: 16,
      textAlign: "center",
      color: Colors.link,
    },
  });
