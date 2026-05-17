import { useEffect, useRef } from "react";
import { Appearance, View, Image, Animated, StyleSheet } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ThemeColors } from "../../store/theme-context";
import { LightColors } from "../../constants/colors/light";
import { DarkColors } from "../../constants/colors/dark";

SplashScreen.preventAutoHideAsync();

const CustomSplash = ({ onFinish }: { onFinish: () => void }) => {
  const colorScheme = Appearance.getColorScheme();
  const Colors = colorScheme === "dark" ? DarkColors : LightColors;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation();
  const styles = stylesFn(Colors);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(async () => {
      await SplashScreen.hideAsync();
      setTimeout(() => onFinish?.(), 500);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/splash-icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <SafeAreaView style={styles.bottomContainer}>
        <Animated.Text style={[styles.bottomText, { opacity: fadeAnim }]}>
          {t("app_name")}
        </Animated.Text>
      </SafeAreaView>
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
      maxWidth: "40%",
      aspectRatio: 1,
    },
    bottomContainer: {
      position: "absolute",
      bottom: 40,
      left: 0,
      right: 0,
      alignItems: "center",
    },
    bottomText: {
      fontSize: 16,
      color: Colors.textSecondary,
      textAlign: "center",
    },
  });
