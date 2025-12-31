import { useState } from "react";
import { Alert, StyleSheet, View, Image, Text, ScrollView } from "react-native";

import FlatButton from "../ui/FlatButton";
import AuthForm from "./AuthForm";
import { Colors } from "../../constants/styles";
import { useNavigation } from "@react-navigation/native";

function AuthContent({ isLogin, onAuthenticate }) {
  const navigation = useNavigation();

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
      Alert.alert("Invalid input", "Please check your entered credentials.");
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
    <ScrollView>
      <View style={styles.imageContainer}>
        <View style={styles.logo}>
          <Image
            source={require("../../assets/logo-dibird-512.png")}
            style={styles.image}
          />
        </View>
        <Text style={styles.logoText}>
          <Text style={styles.logoAccent}>Di</Text>Bird
          </Text>
      </View>

      <View style={styles.authContent}>
        <AuthForm
          isLogin={isLogin}
          onSubmit={submitHandler}
          credentialsInvalid={credentialsInvalid}
        />
        <View style={styles.buttons}>
          <FlatButton onPress={switchAuthModeHandler}>
            {isLogin ? "Create a new user" : "Log in instead"}
          </FlatButton>
        </View>
      </View>
    </ScrollView>
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
    flexDirection: "row",
  },
  imageContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  image: {
    width: 50,
    height: 50,
    resizeMode: "contain",
    marginRight: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.logoText,
  },
  logoAccent: {
    color: Colors.link,
  }
});
