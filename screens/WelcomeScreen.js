import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../store/theme-context";
import Layout from "../components/ui/Layout";
import Logo from "../components/ui/Logo";
import { LoginWithGoogle, LoginWithApple } from "../services/authService";
import { showError } from "../services/api";

const WelcomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, insets);

  const handleGoogle = async () => {
    try {
      await LoginWithGoogle();
    } catch (e) {
      if (e.code !== "SIGN_IN_CANCELLED") {
        showError(e);
      }
    }
  };

  const handleApple = async () => {
    try {
      await LoginWithApple();
    } catch (e) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        showError(e);
      }
    }
  };

  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  return (
    <Layout>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Logo withText={false} style={styles.logoBox} />
          <Text style={styles.title}>{t("welcome")}</Text>
          <Text style={styles.subtitle}>{t("sign_in_or_create")}</Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: Colors.main100, borderColor: Colors.main100 },
            ]}
            onPress={() => navigation.navigate("Login")}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={Colors.textOpposite}
            />
            <Text style={[styles.buttonText, { color: Colors.textOpposite }]}>
              {t("continue_with_email")}
            </Text>
          </TouchableOpacity>

          {appleAvailable && (
            <TouchableOpacity style={styles.button} onPress={handleApple}>
              <Ionicons name="logo-apple" size={20} color={Colors.textMain} />
              <Text style={styles.buttonText}>{t("continue_with_apple")}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.button} onPress={handleGoogle}>
            <Ionicons name="logo-google" size={20} color={Colors.textMain} />
            <Text style={styles.buttonText}>{t("continue_with_google")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Layout>
  );
};

const stylesFn = (Colors, insets) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    },
    header: {
      alignItems: "center",
      marginBottom: 48,
    },
    logoBox: {
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: "500",
      marginBottom: 6,
      color: Colors.main100,
    },
    subtitle: {
      fontSize: 14,
      color: Colors.textMiddle,
    },
    buttons: {
      gap: 12,
      marginBottom: 24,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 0.5,
      backgroundColor: Colors.primary100,
      borderColor: Colors.border,
    },
    buttonText: {
      fontSize: 15,
      color: Colors.textMain,
    },
    footer: {
      textAlign: "center",
      fontSize: 13,
    },
  });

export default WelcomeScreen;
