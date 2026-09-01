import { useEffect, useRef, useState } from "react";
import { Text, ActivityIndicator, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import { useTheme, ThemeColors } from "../store/theme-context";
import { useAuth } from "../store/auth-context";
import Layout from "../components/ui/Layout";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import Logo from "../components/ui/Logo";
import {
  AppError,
  AppStackNavigationProp,
  AuthStackNavigationProp,
  AuthStackRouteProp,
} from "../types";
import { sendConfirmEmail } from "../util/fetches";
import { EMAILS_QUERY_KEY } from "../constants/accountQueryKeys";
import { logError } from "../services/errors";

const ConfirmEmailScreen = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const route = useRoute<AuthStackRouteProp<"ConfirmEmail">>();
  const { t } = useTranslation();
  const { key } = route.params;
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // The screen is registered in both stacks (a link confirming a *second*
  // address arrives while its owner is signed in), and the way onward differs:
  // a guest has just unlocked the login, while someone already inside came
  // from the e-mail list and belongs back there. Same navigation object twice,
  // typed for each stack — the routes of one do not exist in the other.
  const navigation = useNavigation<AuthStackNavigationProp>();
  const appNavigation = useNavigation<AppStackNavigationProp>();

  const isConfirmedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(
    null,
  );

  const confirmEmail = async () => {
    if (!key || isConfirmedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const resp = await sendConfirmEmail(key);

      if (resp.status === 200) {
        isConfirmedRef.current = true;

        if (isAuthenticated) {
          await queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
          Toast.show({ type: "success", text1: t("email_confirmed") });
          // replace, not navigate: the confirmation is spent, and Back from
          // the list should reach Main (put under this screen by linking.ts)
          // rather than a screen that would only report a dead key.
          appNavigation.replace("Emails");
          return;
        }

        navigation.navigate("Login", {
          emailConfirmed: true,
          prefillEmail: resp.data?.email || "",
        });
      } else {
        setError({
          title: t("error"),
          message: t("email_confirmation_failed"),
        });
      }
    } catch (e) {
      const error = e as AppError;
      logError(error, "ConfirmEmail API ERROR");

      setError({
        title: t("error"),
        message:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          t("email_confirmation_failed"),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    confirmEmail();
  }, [key]);

  return (
    <Layout>
      <View style={styles.container}>
        {loading ? (
          <>
            <Logo />
            <Text style={styles.title}>{t("verifying_email")}</Text>
            <Text style={styles.subtitle}>{t("please_wait")}</Text>
            <ActivityIndicator size="large" color={Colors.main100} />
          </>
        ) : error ? (
          <ErrorOverlay
            title={error.title}
            message={error.message}
            onPress={confirmEmail}
            logo
          />
        ) : null}
      </View>
    </Layout>
  );
};

export default ConfirmEmailScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    title: {
      marginTop: 16,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
      color: Colors.textMain,
    },
    subtitle: {
      marginTop: 8,
      marginBottom: 36,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      color: Colors.textSecondary,
    },
  });
