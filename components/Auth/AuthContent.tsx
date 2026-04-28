import { useState, useCallback } from "react";
import { StyleSheet, View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";

import AuthForm from "./AuthForm";
import Logo from "../ui/Logo";
import { showError } from "../../services/api";
import { useTheme, ThemeColors } from "../../store/theme-context";
import FormWrapper from "../ui/FormWrapper";
import { AppError, AuthDrawerNavigationProp, Credentials } from "../../types";

interface AuthContent {
  onAuthenticate: (data: Credentials) => Promise<void>;
  loading: boolean;
  isLogin?: boolean;
  emailConfirmed?: boolean;
  prefillEmail?: string;
}

const AuthContent = ({
  isLogin,
  onAuthenticate,
  loading = false,
  emailConfirmed,
  prefillEmail,
}: AuthContent) => {
  const navigation = useNavigation<AuthDrawerNavigationProp>();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const headerHeight = useHeaderHeight();

  const [credentialsInvalid, setCredentialsInvalid] = useState({
    email: false,
    password: false,
    userName: false,
    confirmPassword: false,
  });

  const switchAuthModeHandler = () => {
    if (isLogin) {
      navigation.navigate("Signup");
    } else {
      navigation.navigate("Login", {
        emailConfirmed,
        prefillEmail,
      });
    }
  };

  const extractApiError = useCallback(
    (err: AppError) => {
      const data = err.response?.data;
      if (!data)
        return {
          title: isLogin ? t("login_failed") : t("registration_failed"),
          message: isLogin ? t("could_not_login") : t("could_not_signup"),
        };
      const apiMessage =
        data?.non_field_errors?.[0] ||
        data?.email?.[0] ||
        data?.username?.[0] ||
        data?.password?.[0] ||
        Object.values(data).flat().join("\n");
      return {
        title: isLogin ? t("login_failed") : t("registration_failed"),
        message:
          apiMessage ||
          (isLogin ? t("could_not_login") : t("could_not_signup")),
      };
    },
    [isLogin, t],
  );

  const submitHandler = async (credentials: Credentials) => {
    let { email, userName, password, confirmPassword } = credentials;

    email = email.trim();
    password = password.trim();

    const emailIsValid = email.includes("@");
    const passwordIsValid = password.length > 6;
    const userNameIsValid =
      !isLogin && userName && userName.length > 0 && userName !== email;
    const passwordsAreEqual = !isLogin ? confirmPassword === password : true;
    const authData = isLogin
      ? { email, password }
      : { email, password, userName: userName! };

    if (
      !emailIsValid ||
      !passwordIsValid ||
      (!isLogin && (!userNameIsValid || !passwordsAreEqual))
    ) {
      Toast.show({
        type: "error",
        text1: t("invalid_input"),
        text2: t("check_credentials"),
      });
      setCredentialsInvalid({
        email: !emailIsValid,
        userName: !isLogin && !userNameIsValid,
        password: !passwordIsValid,
        confirmPassword: !isLogin && !passwordsAreEqual,
      });
      return;
    }

    try {
      await onAuthenticate(authData);
    } catch (e) {
      showError(e as AppError, extractApiError);
    }
  };

  return (
    <FormWrapper
      style={{ paddingTop: headerHeight }}
      header={
        <View style={styles.welcomeSection}>
          <Logo style={styles.logo} imageSize={70} withText={false} />
          <View style={styles.headerTextBlock}>
            {isLogin && emailConfirmed ? (
              <View>
                <Text style={styles.dateText}>{t("email_confirmed")}</Text>
                <Text style={styles.welcomeText}>{t("can_login_now")}</Text>
              </View>
            ) : (
              <View>
                <Text style={styles.welcomeText}>
                  {isLogin ? t("welcome_back") : t("welcome")}
                </Text>
                <Text style={styles.dateText}>
                  {isLogin ? t("login_to_continue") : t("create_account")}
                </Text>
              </View>
            )}
          </View>
        </View>
      }
      bottomButtonLabel={isLogin ? t("create_new_user") : t("login_instead")}
      bottomButtonHandler={switchAuthModeHandler}
    >
      <AuthForm
        isLogin={isLogin}
        onSubmit={submitHandler}
        credentialsInvalid={credentialsInvalid}
        loading={loading}
        prefillEmail={prefillEmail}
      />
    </FormWrapper>
  );
};

export default AuthContent;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    welcomeSection: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 40,
      marginBottom: 24,
      paddingRight: 16,
    },
    headerTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    welcomeText: {
      fontSize: 16,
      marginVertical: 4,
      color: Colors.textMiddle,
      flexShrink: 1,
    },
    dateText: {
      fontSize: 22,
      fontWeight: "700",
      color: Colors.main100,
      flexShrink: 1,
      flexWrap: "wrap",
    },
    logo: {
      alignSelf: "center",
      marginRight: 16,
    },
  });
