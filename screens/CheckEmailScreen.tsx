import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRoute } from "@react-navigation/native";
import Toast from "react-native-toast-message";

import { useTheme, ThemeColors } from "../store/theme-context";
import Layout from "../components/ui/Layout";
import Logo from "../components/ui/Logo";
import AnimatedLoadingButton from "../components/ui/AnimatedLoadingButton";
import { useApiError } from "../hooks/useApiError";
import { AuthStackRouteProp } from "../types";
import { openSupportEmail } from "../util/openSupportEmail";
import { requestPasswordReset, resendVerificationEmail } from "../util/auth";

/**
 * "We sent you a letter" — for both letters the app can cause.
 *
 * `mode` decides which: `signup` is the address-confirmation letter, `reset`
 * the password-reset one. Only the wording and the endpoint behind "send it
 * again" differ, and neither is worth a second screen.
 */
const CheckEmailScreen = () => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const route = useRoute<AuthStackRouteProp<"CheckEmail">>();
  const { showErrorToast } = useApiError();
  const styles = stylesFn(Colors);

  const email = route.params?.email;
  const mode = route.params?.mode ?? "signup";
  const [resending, setResending] = useState(false);

  if (!email) return null;

  const handleResend = async () => {
    if (resending) return;

    setResending(true);
    try {
      if (mode === "reset") {
        await requestPasswordReset(email);
      } else {
        await resendVerificationEmail(email);
      }
      Toast.show({
        type: "success",
        text1: t("confirmation_sent_to", { email }),
      });
    } catch (e) {
      showErrorToast(e, "ResendLetter");
    } finally {
      setResending(false);
    }
  };

  return (
    <Layout>
      <View style={styles.container}>
        <Logo />
        <Text style={styles.title}>
          {mode === "reset"
            ? t("reset_link_sent_to", { email })
            : t("confirmation_sent_to", { email })}
        </Text>
        <Text style={styles.subtitle}>
          {t("verification_sent_before")}
          <Text
            style={{ color: Colors.main100, textDecorationLine: "underline" }}
            onPress={openSupportEmail}
          >
            {t("verification_sent_link")}
          </Text>
          {t("verification_sent_after")}
        </Text>
        <View style={styles.buttonContainer}>
          <AnimatedLoadingButton
            onPress={handleResend}
            loading={resending}
            testID="resend-letter-button"
          >
            {t("resend_letter")}
          </AnimatedLoadingButton>
        </View>
      </View>
    </Layout>
  );
};

export default CheckEmailScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    title: {
      marginTop: 24,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
      color: Colors.textMain,
    },
    subtitle: {
      marginVertical: 24,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      color: Colors.textSecondary,
    },
    buttonContainer: {
      alignSelf: "stretch",
      borderRadius: 16,
    },
  });
