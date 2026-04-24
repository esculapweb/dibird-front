import { View, ScrollView, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { useTheme } from "../../store/theme-context";
import BackgroundScene from "./BackgroundScene";

const Layout = ({
  children,
  top,
  bottom,
  withKeyboard = false,
  withScroll = false,
  style,
  contentContainerStyle,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.container}>
      <BackgroundScene />
      {withKeyboard ? (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.kyeboardAware}
          style={style}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={100}
        >
          {top}
          {children}
        </KeyboardAwareScrollView>
      ) : withScroll ? (
        <ScrollView style={[styles.inner, style]} contentContainerStyle={contentContainerStyle}>
          {top}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.inner, style]}>
          {top}
          {children}
        </View>
      )}
      {bottom}
    </View>
  );
};

export default Layout;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.backgroundMain,
    },
    kyeboardAware: {
      flexGrow: 1,
    },
    inner: {
      flex: 1,
    },
  });
