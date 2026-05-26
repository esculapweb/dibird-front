import { useEffect } from "react";
import {
  useColorScheme,
  View,
  Image,
  Text,
  StyleSheet,
} from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ThemeColors } from "../../store/theme-context";
import { LightColors } from "../../constants/colors/light";
import { DarkColors } from "../../constants/colors/dark";

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
  const { t } = useTranslation();
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
      <SafeAreaView style={styles.bottomContainer}>
        <Text style={styles.bottomText}>{t("app_name")}</Text>
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
