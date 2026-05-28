import { ReactNode } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import BackgroundScene2 from "./BackgroundScene2";
import { StyleType } from "../../types";
import { useContentWidth } from "../../hooks/useContentWidth";

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
  const maxWidth = useContentWidth();

  return (
    <View style={styles.container}>
      {!hideBackground && <BackgroundScene2 />}
      {withKeyboard ? (
        <KeyboardAwareScrollView
          contentContainerStyle={styles.kyeboardAware}
          style={[style, { width: "100%", maxWidth }]}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={100}
        >
          {top}
          {children}
        </KeyboardAwareScrollView>
      ) : withScroll ? (
        <ScrollView
          style={[styles.inner, style, { maxWidth }]}
          contentContainerStyle={contentContainerStyle}
        >
          {top}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.inner, style, { maxWidth }]}>
          {top}
          {children}
        </View>
      )}
      {bottom && <View style={styles.bottom}>{bottom}</View>}
    </View>
  );
};

export default Layout;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  kyeboardAware: {
    flexGrow: 1,
    width: "100%",
  },
  inner: {
    flex: 1,
    width: "100%",
  },
  bottom: {
    width: "100%",
    alignSelf: "stretch",
  },
});
