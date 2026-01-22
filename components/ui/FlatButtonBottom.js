import { Pressable, StyleSheet, View, Text } from "react-native";

import { Colors } from "../../constants/styles";

const FlatButtonBottom = ({ children, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.flatButtonContainer,
        pressed && styles.pressed,
      ]}
    >
      <View>
        <Text style={styles.buttonText}>{children}</Text>
      </View>
    </Pressable>
  );
};

export default FlatButtonBottom;

const styles = StyleSheet.create({
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
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.primary100,
  },
});
