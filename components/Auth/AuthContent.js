import { useState } from "react";
import { Alert, StyleSheet, View, Platform, Text} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import FlatButton from "../ui/FlatButton";
import AuthForm from "./AuthForm";
import { useNavigation } from "@react-navigation/native";
import Logo from "../ui/Logo";
import { Colors } from "../../constants/styles";
import { API_ERROR } from "../../services/api";

function AuthContent({ isLogin, onAuthenticate, loading }) {
  const navigation = useNavigation();
  const { t } = useTranslation();

  const [credentialsInvalid, setCredentialsInvalid] = useState({
    email: false,
    password: false,
    userName: false,
    confirmPassword: false,
  });
  const [error, setError] = useState(null);

  const switchAuthModeHandler = () => {
    const nextPage = isLogin ? "Signup" : "Login";
    setError(null);
    // onAuthenticate.reset?.(); // если нужно сбросить форму
    nextPage && navigation?.navigate(nextPage);
  }

  const  submitHandler = async (credentials) => {
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

    setError(null);

    try {
      await onAuthenticate(authData);
    } catch (err) {
      if (err.code === API_ERROR.TIMEOUT) {
        setError(t("server_timeout")); 
      } else if (err.code === API_ERROR.NETWORK) {
        setError(t("unable_connect_server"));
      } else if (err.code === API_ERROR.SERVER) {
        setError(t("server_unavailable"));
      } else {
        setError(t("something_went_wrong"));
      }
    }
  }

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
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
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
  errorContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
});
