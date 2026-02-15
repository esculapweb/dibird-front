import { useState } from "react";
import { StyleSheet, View, Platform, Text, Dimensions } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import FlatButtonBottom from "../ui/FlatButtonBottom";
import AuthForm from "./AuthForm";
import { useNavigation } from "@react-navigation/native";
import Logo from "../ui/Logo";
import { showError } from "../../services/api";
import { useTheme } from "../../store/theme-context";

const { width } = Dimensions.get("window");

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
    <View style={styles.safeArea}>
      <View style={styles.backgroundBlob1} />
      <View style={styles.backgroundBlob2} />
      <View style={styles.backgroundBlob3} />

      <View style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.container}
          enableOnAndroid
          keyboardShouldPersistTaps="handled"
          extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeEmoji}>🦩</Text>
              <View>
                <Text style={styles.welcomeText}>
                  {isLogin ? t("welcome_back") : t("welcome")}
                </Text>
                <Text style={styles.dateText}>
                  {isLogin ? t("login_to_continue") : t("create_account")}
                </Text>
              </View>
            </View>

            <LinearGradient
              colors={[Colors.mainCardBg1, Colors.mainCardBg2]}
              start={[0, 0]}
              end={[1, 1]}
              style={styles.authCard}
            >
              <Logo style={styles.logo} imageSize={70} withText={false} />
              <Text style={styles.appName}>Nature Log</Text>

              <AuthForm
                isLogin={isLogin}
                onSubmit={submitHandler}
                credentialsInvalid={credentialsInvalid}
                loading={loading}
              />
            </LinearGradient>
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

const stylesFn = (Colors) =>
  StyleSheet.create({
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
    backgroundBlob1: {
      position: "absolute",
      width: 250,
      height: 250,
      borderRadius: 100,
      top: -50,
      right: -80,
      opacity: 0.6,
      transform: [{ rotate: "25deg" }],
      backgroundColor: Colors.mainBlob1,
    },
    backgroundBlob2: {
      position: "absolute",
      width: 200,
      height: 200,
      borderRadius: 60,
      bottom: 100,
      left: -60,
      opacity: 0.5,
      transform: [{ rotate: "-15deg" }],
      backgroundColor: Colors.mainBlob2,
    },
    backgroundBlob3: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: 50,
      top: "60%",
      right: -40,
      opacity: 0.4,
      transform: [{ rotate: "45deg" }],
      backgroundColor: Colors.mainBlob3,
    },
    welcomeSection: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 40,
      marginBottom: 24,
    },
    welcomeEmoji: {
      fontSize: 44,
      marginRight: 16,
    },
    welcomeText: {
      fontSize: 16,
      fontWeight: "500",
      marginBottom: 4,
      color: Colors.textSecondary,
    },
    dateText: {
      fontSize: 22,
      fontWeight: "700",
      color: Colors.mainTextDate,
    },
    authCard: {
      padding: 24,
      borderRadius: 32,
      backgroundColor: Colors.mainCardBg1,
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      shadowColor: Colors.shadow,
      elevation: 8,
      overflow: "hidden",
      marginBottom: 16,
    },
    logo: {
      alignSelf: "center",
      marginBottom: 12,
    },
    appName: {
      fontSize: 24,
      fontWeight: "700",
      color: Colors.mainTextPrimary,
      letterSpacing: 1,
      textAlign: "center",
      marginBottom: 24,
    },
  });
