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
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { ThemeColors, useTheme } from "../store/theme-context";
import Layout from "../components/ui/Layout";
import Logo from "../components/ui/Logo";
import { LoginWithGoogle, LoginWithApple } from "../util/auth";
import { showError } from "../services/api";
import { AppError, AuthDrawerNavigationProp } from "../types";

const WelcomeScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, insets);
  const navigation = useNavigation<AuthDrawerNavigationProp>();

  const handleGoogle = async () => {
    try {
      await LoginWithGoogle();
    } catch (e) {
      const err = e as AppError;
      if (err.code !== "SIGN_IN_CANCELLED") {
        showError(err);
      }
    }
  };

  const handleApple = async () => {
    try {
      await LoginWithApple();
    } catch (e) {
      const err = e as AppError;
      if (err.code !== "ERR_REQUEST_CANCELED") {
        showError(err);
      }
    }
  };

  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const Agreement = () => (
    <View style={styles.agreement}>
      <Text style={[styles.legalText, { color: Colors.textMiddle }]}>
        {t("by_continuing")}{" "}
        <Text
          style={[styles.legalLink, { color: Colors.main100 }]}
          onPress={() => navigation.navigate("Terms")}
        >
          {t("terms_of_service_")}
        </Text>{" "}
        {t("and")}{" "}
        <Text
          style={[styles.legalLink, { color: Colors.main100 }]}
          onPress={() => navigation.navigate("Privacy")}
        >
          {t("privacy_policy_")}
        </Text>
      </Text>
    </View>
  );

  return (
    <Layout bottom={<Agreement />}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Logo withText={false} style={styles.logoBox} />
          <Text style={styles.title}>{t("welcome")}</Text>
          <Text style={styles.subtitle}>{t("sign_in_or_create")}</Text>
        </View>

        <View style={styles.buttons}>
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

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t("or")}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: Colors.main100, borderColor: Colors.main100 },
            ]}
            onPress={() =>
              navigation.navigate("Login")
            }
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
        </View>
      </ScrollView>
    </Layout>
  );
};

const stylesFn = (Colors: ThemeColors, insets: EdgeInsets) =>
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
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 4,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.tabBorder,
    },
    dividerText: {
      marginHorizontal: 12,
      fontSize: 13,
      color: Colors.textMiddle,
    },
    agreement: {
      paddingTop: 6,
      paddingBottom: insets.bottom,
      marginHorizontal: 28,
      borderTopColor: Colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    legalText: {
      textAlign: "center",
      fontSize: 12,
      lineHeight: 18,
      paddingHorizontal: 8,
    },
    legalLink: {
      textDecorationLine: "underline",
    },
  });

export default WelcomeScreen;
