import { useEffect, useRef, useState } from "react";
import { Text, ActivityIndicator, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../store/theme-context";
import Layout from "../components/ui/Layout";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import api from "../services/api";
import Logo from "../components/ui/Logo";
import {
  AppError,
  AuthStackNavigationProp,
  AuthStackRouteProp,
} from "../types";

const ConfirmEmailScreen = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const route = useRoute<AuthStackRouteProp<"ConfirmEmail">>();
  const { t } = useTranslation();
  const { key } = route.params;
  const navigation = useNavigation<AuthStackNavigationProp>();

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
      const resp = await api.post("/myapi/confirm/email/", { key });

      if (resp.status === 200) {
        isConfirmedRef.current = true;
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
      console.warn(
        "ConfirmEmail API ERROR:",
        error.response?.data || error.message,
      );
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
