import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import AnimatedLoadingButton from "../ui/AnimatedLoadingButton";
import Input from "../ui/Input";

const AuthForm = ({ isLogin, onSubmit, credentialsInvalid, loading }) => {
  const [enteredEmail, setEnteredEmail] = useState("");
  const [enteredUsername, setEnteredUsername] = useState("");
  const [enteredPassword, setEnteredPassword] = useState("");
  const [enteredConfirmPassword, setEnteredConfirmPassword] = useState("");
  const { t } = useTranslation();

  const {
    email: emailIsInvalid,
    userName: userNameIsInvalid,
    password: passwordIsInvalid,
    confirmPassword: passwordsDontMatch,
  } = credentialsInvalid;

  const updateInputValueHandler = (inputType, enteredValue) => {
    switch (inputType) {
      case "email":
        setEnteredEmail(enteredValue);
        break;
      case "userName":
        setEnteredUsername(enteredValue);
        break;
      case "password":
        setEnteredPassword(enteredValue);
        break;
      case "confirmPassword":
        setEnteredConfirmPassword(enteredValue);
        break;
    }
  }

  const submitHandler = () => {
    onSubmit({
      email: enteredEmail,
      userName: enteredUsername,
      password: enteredPassword,
      confirmPassword: enteredConfirmPassword,
    });
  }

  return (
    <View>
      <Input
        label={t("email_address")}
        onUpdateValue={updateInputValueHandler.bind(this, "email")}
        value={enteredEmail}
        keyboardType="email-address"
        isInvalid={emailIsInvalid}
      />
      {!isLogin && (
        <Input
          label={t("username")}
          onUpdateValue={updateInputValueHandler.bind(this, "userName")}
          value={enteredUsername}
          isInvalid={userNameIsInvalid}
        />
      )}
      <Input
        label={t("password")}
        onUpdateValue={updateInputValueHandler.bind(this, "password")}
        secure
        value={enteredPassword}
        isInvalid={passwordIsInvalid}
      />
      {!isLogin && (
        <Input
          label={t("confirm_password")}
          onUpdateValue={updateInputValueHandler.bind(this, "confirmPassword")}
          secure
          value={enteredConfirmPassword}
          isInvalid={passwordsDontMatch}
        />
      )}
      <View style={styles.buttons}>
        <AnimatedLoadingButton onPress={submitHandler} loading={loading}>
          {isLogin ? t("log_in") : t("sign_up")}
        </AnimatedLoadingButton>
      </View>
    </View>
  );
}

export default AuthForm;

const styles = StyleSheet.create({
  buttons: {
    marginVertical: 8,
  },
});
