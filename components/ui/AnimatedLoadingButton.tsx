import { useRef, useEffect, ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, ThemeColors } from "../../store/theme-context";

const BUTTON_HEIGHT = 48;
const SUCCESS_DISPLAY_TIME = 3000;

interface AnimatedLoadingButtonProps {
  onPress: () => void;
  loading: boolean;
  success?: boolean;
  children: ReactNode;
  testID?: string;
}

const AnimatedLoadingButton = ({
  onPress,
  loading,
  success,
  children,
  testID,
}: AnimatedLoadingButtonProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const spinnerOpacity = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(spinnerOpacity, {
      toValue: loading ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [loading]);

  useEffect(() => {
    if (success) {
      Animated.sequence([
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(SUCCESS_DISPLAY_TIME),
        Animated.timing(successOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [success]);

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        pressed && !loading ? styles.pressed : null,
        loading ? styles.disabled : null,
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.text}>{children}</Text>

        <Animated.View style={[styles.spinner, { opacity: spinnerOpacity }]}>
          <ActivityIndicator size="small" color={Colors.textOpposite} />
        </Animated.View>

        <Animated.View style={[styles.spinner, { opacity: successOpacity }]}>
          <Ionicons name="checkmark" size={20} color={Colors.textOpposite} />
        </Animated.View>
      </View>
    </Pressable>
  );
};

export default AnimatedLoadingButton;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    button: {
      borderRadius: 8,
      height: BUTTON_HEIGHT,
      paddingHorizontal: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.main100,
    },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.6 },
    content: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      flex: 1,
    },
    text: {
      color: Colors.textOpposite,
      fontWeight: "600",
      fontSize: 16,
      position: "absolute",
      alignSelf: "center",
    },
    spinner: {
      position: "absolute",
      right: 0,
      top: "50%",
      marginTop: -9,
    },
  });
