import { useState } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import FlatButton from "../ui/FlatButton";
import AuthForm from "./AuthForm";
import { useNavigation } from "@react-navigation/native";
import Logo from "../ui/Logo";
import { Colors } from "../../constants/styles";
import { mapErrorToToast } from "../../services/api";

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
    const nextPage = isLogin ? "Signup" : "Login";
    // onAuthenticate.reset?.(); // если нужно сбросить форму
    nextPage && navigation?.navigate(nextPage);
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
      message: apiMessage ||
      (isLogin ? t("could_not_login") : t("could_not_signup")),
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
    } catch (err) {
      const { title, message } = mapErrorToToast(err, extractApiError);
      Toast.show({
        type: "error",
        text1: title,
        text2: message,
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
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
          <View style={styles.buttons}>
            <FlatButton onPress={switchAuthModeHandler}>
              {isLogin ? t("create_new_user") : t("login_instead")}
            </FlatButton>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

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
  buttons: {
    marginTop: "auto",
  },
});
