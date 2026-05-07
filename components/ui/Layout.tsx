import { ReactNode } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { useTheme, ThemeColors } from "../../store/theme-context";
import BackgroundScene2 from "./BackgroundScene2";
import { StyleType } from "../../types";

interface LayoutProps {
  children: ReactNode;
  top?: ReactNode;
  bottom?: ReactNode;
  withKeyboard?: boolean;
  withScroll?: boolean;
  style?: StyleType;
  contentContainerStyle?: StyleType;
  hideBackground?: boolean;
}

const Layout = ({
  children,
  top,
  bottom,
  withKeyboard = false,
  withScroll = false,
  style,
  contentContainerStyle,
  hideBackground = false,
}: LayoutProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.container}>
      {!hideBackground && <BackgroundScene2 />}
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
        <ScrollView
          style={[styles.inner, style]}
          contentContainerStyle={contentContainerStyle}
        >
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

const stylesFn = (Colors: ThemeColors) =>
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
