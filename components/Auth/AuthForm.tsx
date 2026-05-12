import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import AnimatedLoadingButton from "../ui/AnimatedLoadingButton";
import Input from "../ui/Input";
import { Credentials, CredentialsValidation } from "../../types";

interface AuthFormProps {
  isLogin?: boolean;
  onSubmit: (credentials: Credentials) => Promise<void>;
  credentialsInvalid: CredentialsValidation;
  loading: boolean;
  prefillEmail?: string;
}

type inputTypes = "email" | "userName" | "password" | "confirmPassword";

const AuthForm = ({
  isLogin,
  onSubmit,
  credentialsInvalid,
  loading,
  prefillEmail,
}: AuthFormProps) => {
  const [enteredEmail, setEnteredEmail] = useState(prefillEmail ?? "");
  const [enteredUsername, setEnteredUsername] = useState("");
  const [enteredPassword, setEnteredPassword] = useState("");
  const [enteredConfirmPassword, setEnteredConfirmPassword] = useState("");
  const { t } = useTranslation();
  const styles = stylesFn();

  const {
    email: emailIsInvalid,
    userName: userNameIsInvalid,
    password: passwordIsInvalid,
    confirmPassword: passwordsDontMatch,
  } = credentialsInvalid;

  const updateInputValueHandler = (
    inputType: inputTypes,
    enteredValue: string,
  ) => {
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
  };

  const submitHandler = () => {
    onSubmit({
      email: enteredEmail,
      userName: enteredUsername,
      password: enteredPassword,
      confirmPassword: enteredConfirmPassword,
    });
  };

  return (
    <View>
      {!isLogin && (
        <Input
          label={t("username")}
          onUpdateValue={updateInputValueHandler.bind(this, "userName")}
          value={enteredUsername}
          isInvalid={userNameIsInvalid}
          textContentType="nickname"
          autoComplete="username"
        />
      )}
      <Input
        label={t("email_address")}
        onUpdateValue={updateInputValueHandler.bind(this, "email")}
        value={enteredEmail}
        keyboardType="email-address"
        isInvalid={emailIsInvalid}
        textContentType="username"
        autoComplete="username"
      />
      {isLogin && (
        <Input
          label={t("password")}
          onUpdateValue={updateInputValueHandler.bind(this, "password")}
          secure
          value={enteredPassword}
          isInvalid={passwordIsInvalid}
          textContentType="password"
          autoComplete="current-password"
        />
      )}
      {!isLogin && (
        <>
          <Input
            label={t("password")}
            onUpdateValue={updateInputValueHandler.bind(this, "password")}
            secure
            value={enteredPassword}
            isInvalid={passwordIsInvalid}
            textContentType="newPassword"
            autoComplete="new-password"
          />

          <Input
            label={t("confirm_password")}
            onUpdateValue={updateInputValueHandler.bind(
              this,
              "confirmPassword",
            )}
            secure
            value={enteredConfirmPassword}
            isInvalid={passwordsDontMatch}
            textContentType="none"
            autoComplete="off"
          />
        </>
      )}
      <View style={styles.buttonContainer}>
        <AnimatedLoadingButton onPress={submitHandler} loading={loading}>
          {isLogin ? t("log_in") : t("sign_up")}
        </AnimatedLoadingButton>
      </View>
    </View>
  );
};

export default AuthForm;

const stylesFn = () =>
  StyleSheet.create({
    buttonContainer: {
      marginVertical: 16,
      borderRadius: 16,
    },
  });
