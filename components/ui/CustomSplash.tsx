import { useEffect } from "react";
import { useColorScheme, View, Image, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";

import { ThemeColors } from "../../store/theme-context";
import { LightColors } from "../../constants/colors/light";
import { DarkColors } from "../../constants/colors/dark";
import { getFullVersion } from "../../util/helpers";

SplashScreen.preventAutoHideAsync();

const CustomSplash = ({
  onFinish,
  waitFor,
}: {
  onFinish: () => void;
  waitFor?: Promise<void>;
}) => {
  const colorScheme = useColorScheme();
  const Colors = colorScheme === "dark" ? DarkColors : LightColors;
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors);

  useEffect(() => {
    const run = async () => {
      await waitFor;
      await SplashScreen.hideAsync();
      onFinish?.();
    };

    const timer = setTimeout(run, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/splash-icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={[styles.bottomText, { bottom: insets.bottom + 24 }]}>
        v{getFullVersion()}
      </Text>
    </View>
  );
};

export default CustomSplash;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.primary100,
      justifyContent: "center",
      alignItems: "center",
    },
    logo: {
      width: 150,
      height: 150,
      aspectRatio: 1,
    },
    bottomText: {
      position: "absolute",
      left: 0,
      right: 0,
      fontSize: 16,
      color: Colors.textSecondary,
      textAlign: "center",
      opacity: 0.5,
      letterSpacing: 0.3,
    },
  });
