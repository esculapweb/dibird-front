import { useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";

import AuthForm from "./AuthForm";
import Logo from "../ui/Logo";
import { showError } from "../../services/api";
import { useTheme } from "../../store/theme-context";
import FormWrapper from "../ui/FormWrapper";

const AuthContent = ({ isLogin, onAuthenticate, loading }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const [credentialsInvalid, setCredentialsInvalid] = useState({
    email: false,
    password: false,
    userName: false,
    confirmPassword: false,
  });

  const switchAuthModeHandler = () => {
    navigation.navigate(isLogin ? "Signup" : "Login");
  };

  const extractApiError = (err) => {
    const data = err.response.data;
    if (!data) return null;
    const apiMessage =
      data?.non_field_errors?.[0] ||
      data?.email?.[0] ||
      data?.username?.[0] ||
      data?.password?.[0] ||
      Object.values(data).flat().join("\n");
    return {
      title: isLogin ? t("login_failed") : t("registration_failed"),
      message:
        apiMessage || (isLogin ? t("could_not_login") : t("could_not_signup")),
    };
  };

  const submitHandler = async (credentials) => {
    let { email, userName, password, confirmPassword } = credentials;

    email = email.trim();
    password = password.trim();

    const emailIsValid = email.includes("@");
    const passwordIsValid = password.length > 6;
    const userNameIsValid = userName !== email;
    const passwordsAreEqual = password === confirmPassword;
    const authData = isLogin
      ? { email, password }
      : { email, password, userName };

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
        userName: !userNameIsValid,
        password: !passwordIsValid,
        confirmPassword: !passwordIsValid || !passwordsAreEqual,
      });
      return;
    }

    try {
      await onAuthenticate(authData);
    } catch (e) {
      showError(e, extractApiError);
    }
  };

  return (
    <FormWrapper
      header={
        <View style={styles.welcomeSection}>
          <Logo style={styles.logo} imageSize={70} withText={false} />
          <View>
            <Text style={styles.welcomeText}>
              {isLogin ? t("welcome_back") : t("welcome")}
            </Text>
            <Text style={styles.dateText}>
              {isLogin ? t("login_to_continue") : t("create_account")}
            </Text>
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
      />
    </FormWrapper>
  );
};

export default AuthContent;

const stylesFn = (Colors) =>
  StyleSheet.create({
    welcomeSection: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 40,
      marginBottom: 24,
    },
    welcomeText: {
      fontSize: 16,
      fontWeight: "500",
      marginBottom: 4,
      color: Colors.textMiddle,
    },
    dateText: {
      fontSize: 22,
      fontWeight: "700",
      color: Colors.main100,
    },
    logo: {
      alignSelf: "center",
      marginLeft: 24,
      marginRight: 12,
    },
  });
