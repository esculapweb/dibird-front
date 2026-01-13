import { useState } from "react";
import { Alert, StyleSheet, View, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useTranslation } from "react-i18next";

import FlatButton from "../ui/FlatButton";
import AuthForm from "./AuthForm";
import { useNavigation } from "@react-navigation/native";
import Logo from "../ui/Logo";

function AuthContent({ isLogin, onAuthenticate, loading }) {
  const navigation = useNavigation();
  const { t } = useTranslation();

  const [credentialsInvalid, setCredentialsInvalid] = useState({
    email: false,
    password: false,
    userName: false,
    confirmPassword: false,
  });

  function switchAuthModeHandler() {
    const nextPage = isLogin ? "Signup" : "Login";
    navigation.replace(nextPage);
  }

  function submitHandler(credentials) {
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
      Alert.alert(t("invalid_input"), t("check_credentials"));
      setCredentialsInvalid({
        email: !emailIsValid,
        userName: !userNameIsValid,
        password: !passwordIsValid,
        confirmPassword: !passwordIsValid || !passwordsAreEqual,
      });
      return;
    }

    onAuthenticate(authData);
  }

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={styles.container}
      enableOnAndroid
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
    >
      <Logo style={styles.logo} imageSize={60} withText={true} />

      <View style={styles.authContent}>
        <AuthForm
          isLogin={isLogin}
          onSubmit={submitHandler}
          credentialsInvalid={credentialsInvalid}
          ƒ
          loading={loading}
        />
        <View style={styles.buttons}>
          <FlatButton onPress={switchAuthModeHandler}>
            {isLogin ? t("create_new_user") : t("login_instead")}
          </FlatButton>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}

export default AuthContent;

const styles = StyleSheet.create({
  authContent: {
    margin: 24,
  },
  buttons: {
    marginTop: 8,
  },
  logo: {
    marginTop: 16,
  },
});
