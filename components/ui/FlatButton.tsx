import { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { StyleType } from "../../types";

const FlatButton = ({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: StyleType;
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        style && style,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View>
        <Text style={styles.buttonText}>{children}</Text>
      </View>
    </Pressable>
  );
};

export default FlatButton;

const stylesFn = (Colors: ThemeColors) =>
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
      color: Colors.main100,
    },
  });
