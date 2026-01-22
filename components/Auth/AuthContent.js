import { useState } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import FlatButtonBottom from "../ui/FlatButtonBottom";
import AuthForm from "./AuthForm";
import { useNavigation } from "@react-navigation/native";
import Logo from "../ui/Logo";
import { Colors } from "../../constants/styles";
import { showError } from "../../services/api";

const AuthContent = ({ isLogin, onAuthenticate, loading }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();

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
    <View style={styles.safeArea}>
      <View style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.container}
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
          style={{ flex: 1 }}
        >
          <View style={styles.inner}>
            <Logo style={styles.logo} imageSize={60} withText={true} />

            <View style={styles.authContent}>
              <AuthForm
                isLogin={isLogin}
                onSubmit={submitHandler}
                credentialsInvalid={credentialsInvalid}
                loading={loading}
              />
            </View>
          </View>
        </KeyboardAwareScrollView>

        <FlatButtonBottom onPress={switchAuthModeHandler}>
          {isLogin ? t("create_new_user") : t("login_instead")}
        </FlatButtonBottom>
      </View>
    </View>
  );
};

export default AuthContent;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundMain,
  },
  container: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
  },
  logo: {
    marginTop: 24,
    alignSelf: "center",
  },
  authContent: {
    marginTop: 24,
    flex: 1,
    },
});
