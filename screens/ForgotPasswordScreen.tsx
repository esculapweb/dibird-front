import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import Toast from "react-native-toast-message";

import Input from "../components/ui/Input";
import Logo from "../components/ui/Logo";
import AnimatedLoadingButton from "../components/ui/AnimatedLoadingButton";
import FormWrapper from "../components/ui/FormWrapper";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useApiError } from "../hooks/useApiError";
import { requestPasswordReset } from "../util/auth";
import {
  AppError,
  AuthStackNavigationProp,
  AuthStackRouteProp,
  ErrorExtractor,
} from "../types";

const ForgotPasswordScreen = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  const navigation = useNavigation<AuthStackNavigationProp>();
  const route = useRoute<AuthStackRouteProp<"ForgotPassword">>();
  const { showErrorToast } = useApiError();

  const [email, setEmail] = useState(route.params?.prefillEmail ?? "");
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);

  const extractApiError = useCallback<ErrorExtractor>(
    (err) => {
      const data = err.response?.data;
      const message = data
        ? data?.email?.[0] ||
          data?.detail ||
          Object.values(data).flat().join("\n")
        : null;

      return {
        title: t("reset_password_failed"),
        message: message || t("could_not_send_reset_link"),
      };
    },
    [t],
  );

  const submitHandler = async () => {
    if (loading) return;

    const trimmed = email.trim();

    if (!trimmed.includes("@")) {
      setInvalid(true);
      Toast.show({
        type: "error",
        text1: t("invalid_input"),
        text2: t("check_credentials"),
      });
      return;
    }

    setInvalid(false);
    setLoading(true);

    try {
      await requestPasswordReset(trimmed);
      // The server answers 200 for an unknown address too — it will not say
      // whether an account exists, so "sent" is the only thing this screen can
      // honestly report, and the same wording covers both cases.
      navigation.replace("CheckEmail", { email: trimmed, mode: "reset" });
    } catch (e) {
      const err = e as AppError;
      const isConnectivityError = err.isNetworkError || err.isTimeout;
      showErrorToast(
        e,
        "RequestPasswordReset",
        isConnectivityError ? undefined : extractApiError,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormWrapper
      header={
        <View style={styles.header}>
          <Logo style={styles.logo} imageSize={70} withText={false} />
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("forgot_password_title")}</Text>
            <Text style={styles.subtitle}>{t("forgot_password_subtitle")}</Text>
          </View>
        </View>
      }
      bottomButtonLabel={t("back_to_login")}
      bottomButtonHandler={() => navigation.goBack()}
    >
      <Input
        label={t("email_address")}
        onUpdateValue={setEmail}
        value={email}
        keyboardType="email-address"
        isInvalid={invalid}
        textContentType="username"
        autoComplete="email"
        testID="forgot-password-email-input"
      />
      <View style={styles.buttonContainer}>
        <AnimatedLoadingButton
          onPress={submitHandler}
          loading={loading}
          testID="forgot-password-submit-button"
        >
          {t("send_reset_link")}
        </AnimatedLoadingButton>
      </View>
    </FormWrapper>
  );
};

export default ForgotPasswordScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 40,
      marginBottom: 24,
      paddingRight: 16,
    },
    logo: {
      marginRight: 8,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: Colors.main100,
      flexShrink: 1,
      flexWrap: "wrap",
    },
    subtitle: {
      fontSize: 16,
      marginVertical: 4,
      color: Colors.textMiddle,
      flexShrink: 1,
    },
    buttonContainer: {
      marginVertical: 16,
      borderRadius: 16,
    },
  });
