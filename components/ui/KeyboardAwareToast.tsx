import { useEffect, useState } from "react";
import { Keyboard, Platform, StyleSheet, View } from "react-native";
import Toast from "react-native-toast-message";

import ThemedToast from "./ThemedToast";

// react-native-toast-message lifts a bottom toast above the keyboard on iOS
// only (its useKeyboard hook never subscribes on Android), and the window is
// not resized for the keyboard either, so on Android a toast shown while typing
// lands under it. The container is moved rather than passing bottomOffset: the
// library reads that option once per show(), so a toast already on screen would
// not follow the keyboard opening or closing.
const KeyboardAwareToast = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const subscriptions = [
      Keyboard.addListener("keyboardDidShow", (event) =>
        setKeyboardHeight(event.endCoordinates.height),
      ),
      Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0)),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, []);

  return (
    <View
      testID="toast-container"
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { bottom: keyboardHeight }]}
    >
      <Toast config={ThemedToast} position="bottom" />
    </View>
  );
};

export default KeyboardAwareToast;
