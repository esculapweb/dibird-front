import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../store/theme-context";

const Button = ({ children, onPress }) => {
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

export default Button;

const stylesFn = (Colors) =>
  StyleSheet.create({
    button: {
      borderRadius: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 8,
      backgroundColor: Colors.buttonBg,
      // elevation: 2,
      // shadowColor: 'black',
      // shadowOffset: { width: 1, height: 1 },
      // shadowOpacity: 0.25,
      // shadowRadius: 4,
    },
    pressed: {
      opacity: 0.7,
    },
    buttonText: {
      textAlign: "center",
      color: "black",
      fontSize: 16,
      fontWeight: "bold",
    },
  });
