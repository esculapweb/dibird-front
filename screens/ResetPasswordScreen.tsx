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
import { confirmPasswordReset } from "../util/auth";
import { MIN_PASSWORD_LENGTH } from "../constants/auth";
import {
  AppError,
  AuthStackNavigationProp,
  AuthStackRouteProp,
  ErrorExtractor,
} from "../types";

/**
 * The second half of "forgot password": the person got here by tapping the link
 * in the letter, so `uid`/`token` come from the URL (linking.ts) and nothing on
 * this screen identifies them beyond that pair.
 *
 * The key is single-use and expires, and it is the server that knows whether it
 * is still good — hence no client-side validity check, only a readable message
 * when the confirm call refuses it.
 */
const ResetPasswordScreen = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  const navigation = useNavigation<AuthStackNavigationProp>();
  const route = useRoute<AuthStackRouteProp<"ResetPassword">>();
  const { showErrorToast } = useApiError();
  const { uid, token } = route.params;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [invalid, setInvalid] = useState({ password: false, confirm: false });
  const [loading, setLoading] = useState(false);

  const extractApiError = useCallback<ErrorExtractor>(
    (err) => {
      const data = err.response?.data;
      // `token`/`uid` errors mean the link itself is spent or expired — that is
      // a different situation from a weak password, and telling them apart is
      // the whole point: one is fixed by retyping, the other only by asking
      // for a new letter.
      const linkIsDead = Boolean(data?.token || data?.uid);
      const message = data
        ? data?.new_password2?.[0] ||
          data?.new_password1?.[0] ||
          data?.detail ||
          Object.values(data).flat().join("\n")
        : null;

      return {
        title: t("reset_password_failed"),
        message: linkIsDead
          ? t("reset_link_expired")
          : message || t("could_not_reset_password"),
      };
    },
    [t],
  );

  const submitHandler = async () => {
    if (loading) return;

    const trimmed = password.trim();
    const passwordIsValid = trimmed.length >= MIN_PASSWORD_LENGTH;
    const passwordsMatch = trimmed === confirmPassword.trim();

    if (!passwordIsValid || !passwordsMatch) {
      setInvalid({ password: !passwordIsValid, confirm: !passwordsMatch });
      Toast.show({
        type: "error",
        text1: t("invalid_input"),
        text2: passwordIsValid
          ? t("passwords_do_not_match")
          : t("password_too_short", { min: MIN_PASSWORD_LENGTH }),
      });
      return;
    }

    setInvalid({ password: false, confirm: false });
    setLoading(true);

    try {
      await confirmPasswordReset({ uid, token, password: trimmed });
      Toast.show({ type: "success", text1: t("password_changed") });
      // No session comes back from the confirm call, so the way on is the login
      // screen — and the person types the password they have just chosen.
      navigation.replace("Login", undefined);
    } catch (e) {
      const err = e as AppError;
      const isConnectivityError = err.isNetworkError || err.isTimeout;
      showErrorToast(
        e,
        "ConfirmPasswordReset",
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
            <Text style={styles.title}>{t("reset_password_title")}</Text>
            <Text style={styles.subtitle}>{t("reset_password_subtitle")}</Text>
          </View>
        </View>
      }
      bottomButtonLabel={t("back_to_login")}
      bottomButtonHandler={() => navigation.replace("Login", undefined)}
    >
      <Input
        label={t("new_password")}
        onUpdateValue={setPassword}
        value={password}
        secure
        isInvalid={invalid.password}
        textContentType="newPassword"
        autoComplete="new-password"
        testID="reset-password-input"
      />
      <Input
        label={t("confirm_password")}
        onUpdateValue={setConfirmPassword}
        value={confirmPassword}
        secure
        isInvalid={invalid.confirm}
        textContentType="none"
        autoComplete="off"
        testID="reset-password-confirm-input"
      />
      <View style={styles.buttonContainer}>
        <AnimatedLoadingButton
          onPress={submitHandler}
          loading={loading}
          testID="reset-password-submit-button"
        >
          {t("save_new_password")}
        </AnimatedLoadingButton>
      </View>
    </FormWrapper>
  );
};

export default ResetPasswordScreen;

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
