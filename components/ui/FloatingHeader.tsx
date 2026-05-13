import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "../../store/theme-context";
import { StyleType, AnyDrawerNavigationProp } from "../../types";

const H_PAD = 16;

const BurgerButton = ({
  onPress,
  style,
}: {
  onPress: () => void;
  style?: StyleType;
}) => {
  const { Colors } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} hitSlop={8} style={style}>
      <View style={[styles.line, { backgroundColor: Colors.textMain }]} />
      <View style={[styles.line, { backgroundColor: Colors.textMain }]} />
      <View style={[styles.line, { backgroundColor: Colors.textMain }]} />
    </TouchableOpacity>
  );
};

const FloatingHeader = ({ children }: { children?: React.ReactNode }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AnyDrawerNavigationProp>();
  const NAVBAR_HEIGHT = insets.top + 60;

  return (
    <View style={[styles.container, { height: NAVBAR_HEIGHT + 20 }]}>
      <LinearGradient
        colors={
          isDark
            ? ["rgba(18,18,18,0.95)", "rgba(18,18,18,0.4)", "rgba(18,18,18,0)"]
            : [
                "rgba(247,246,242,0.95)",
                "rgba(247,246,242,0.4)",
                "rgba(247,246,242,0)",
              ]
        }
        locations={[0, 0.4, 0.85]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.row, { paddingTop: insets.top + 8 }]}>
        <BurgerButton onPress={() => navigation.openDrawer()} />
        {children}
      </View>
    </View>
  );
};

export default FloatingHeader;

const styles = StyleSheet.create({
  line: { width: 22, height: 2, borderRadius: 1, marginBottom: 5 },
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingBottom: 14,
  },
});
