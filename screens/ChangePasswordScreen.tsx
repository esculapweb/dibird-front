import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import Input from "../components/ui/Input";
import Layout from "../components/ui/Layout";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import AnimatedLoadingButton from "../components/ui/AnimatedLoadingButton";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useApiError } from "../hooks/useApiError";
import { changePassword } from "../util/auth";
import { fetchMyProfile } from "../util/fetches";
import { MIN_PASSWORD_LENGTH } from "../constants/auth";
import { PASSWORD_PROFILE_QUERY_KEY } from "../constants/accountQueryKeys";
import {
  AppError,
  AppStackNavigationProp,
  ErrorExtractor,
  Profile,
} from "../types";

/**
 * Change the password — or set the first one, for an account that has only
 * ever been signed into with Google or Apple.
 *
 * Which of the two it is comes from `has_usable_password`, and it is fetched
 * here rather than read from the profile context on purpose: the flag is not
 * mirrored in SQLite (see the Profile type), because a password can be set on
 * the website and a stale local copy would put someone in front of the wrong
 * form — asking for a current password they do not have, or silently not
 * asking for one they do.
 */
const ChangePasswordScreen = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const { showErrorToast } = useApiError();

  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [invalid, setInvalid] = useState({
    old: false,
    password: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Profile>({
    queryKey: PASSWORD_PROFILE_QUERY_KEY,
    queryFn: fetchMyProfile,
    // No staleTime: the answer changes the moment a password is set, and this
    // screen is exactly where that happens.
    staleTime: 0,
  });

  const hasPassword = profile?.has_usable_password !== false;

  const extractApiError = useCallback<ErrorExtractor>(
    (err) => {
      const data = err.response?.data;
      const message = data
        ? data?.old_password?.[0] ||
          data?.new_password2?.[0] ||
          data?.new_password1?.[0] ||
          data?.detail ||
          Object.values(data).flat().join("\n")
        : null;

      return {
        title: t("change_password_failed"),
        message: message || t("could_not_change_password"),
      };
    },
    [t],
  );

  const submitHandler = async () => {
    if (loading) return;

    const trimmedOld = oldPassword.trim();
    const trimmed = password.trim();
    const oldIsValid = hasPassword ? trimmedOld.length > 0 : true;
    const passwordIsValid = trimmed.length >= MIN_PASSWORD_LENGTH;
    const passwordsMatch = trimmed === confirmPassword.trim();

    if (!oldIsValid || !passwordIsValid || !passwordsMatch) {
      setInvalid({
        old: !oldIsValid,
        password: !passwordIsValid,
        confirm: !passwordsMatch,
      });
      Toast.show({
        type: "error",
        text1: t("invalid_input"),
        text2: !passwordsMatch
          ? t("passwords_do_not_match")
          : t("password_too_short", { min: MIN_PASSWORD_LENGTH }),
      });
      return;
    }

    setInvalid({ old: false, password: false, confirm: false });
    setLoading(true);

    try {
      await changePassword({
        // Omitted, not empty: the backend drops the field entirely for an
        // account with no usable password, and sending it there is a 400.
        oldPassword: hasPassword ? trimmedOld : undefined,
        password: trimmed,
      });
      Toast.show({
        type: "success",
        text1: hasPassword ? t("password_changed") : t("password_set"),
      });
      navigation.goBack();
    } catch (e) {
      const err = e as AppError;
      const isConnectivityError = err.isNetworkError || err.isTimeout;
      showErrorToast(
        e,
        "ChangePassword",
        isConnectivityError ? undefined : extractApiError,
      );
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <LoadingOverlay />;

  if (isError && !profile) {
    return (
      <ErrorOverlay
        title={t("change_password")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );
  }

  return (
    <Layout withKeyboard style={{ paddingHorizontal: 24, paddingTop: 24 }}>
      <Text style={styles.hint}>
        {hasPassword ? t("change_password_hint") : t("set_password_hint")}
      </Text>

      {hasPassword && (
        <Input
          label={t("current_password")}
          onUpdateValue={setOldPassword}
          value={oldPassword}
          secure
          isInvalid={invalid.old}
          textContentType="password"
          autoComplete="current-password"
          testID="current-password-input"
        />
      )}

      <Input
        label={t("new_password")}
        onUpdateValue={setPassword}
        value={password}
        secure
        isInvalid={invalid.password}
        textContentType="newPassword"
        autoComplete="new-password"
        testID="new-password-input"
      />

      <Input
        label={t("confirm_password")}
        onUpdateValue={setConfirmPassword}
        value={confirmPassword}
        secure
        isInvalid={invalid.confirm}
        textContentType="none"
        autoComplete="off"
        testID="new-password-confirm-input"
      />

      <View style={styles.buttonContainer}>
        <AnimatedLoadingButton
          onPress={submitHandler}
          loading={loading}
          testID="change-password-submit-button"
        >
          {hasPassword ? t("save_new_password") : t("set_password")}
        </AnimatedLoadingButton>
      </View>
    </Layout>
  );
};

export default ChangePasswordScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    hint: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 16,
      lineHeight: 18,
    },
    buttonContainer: {
      marginVertical: 16,
      borderRadius: 16,
    },
  });
