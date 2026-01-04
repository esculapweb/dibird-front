import { useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from "react-native";
import { Colors } from "../../constants/styles";

const AnimatedLoadingButton = ({ onPress, loading, children }) => {
  const spinnerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(spinnerOpacity, {
      toValue: loading ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [loading]);

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.button,
        pressed && !loading ? styles.pressed : null,
        loading ? styles.disabled : null,
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.text}>{children}</Text>

        {loading && (
          <Animated.View style={[styles.spinner, { opacity: spinnerOpacity }]}>
            <ActivityIndicator size="small" color={Colors.textMain} />
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
};

export default AnimatedLoadingButton;

const BUTTON_HEIGHT = 48; 

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
    height: BUTTON_HEIGHT,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.6 },
  content: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flex: 1,
  },
  text: {
    color: Colors.textMain,
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
