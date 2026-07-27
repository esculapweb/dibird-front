import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { ThemeColors, useTheme } from "../../store/theme-context";
import { LoginWithGoogle, LoginWithApple } from "../../util/auth";
import { useApiError } from "../../hooks/useApiError";
import { track } from "../../services/analytics";
import { AppError } from "../../types";

interface AuthOptionsProps {
  // Куда ведёт «войти по почте» — экран Login, но пушит его вызывающий: из
  // шторки надо сначала её закрыть.
  onEmailPress: () => void;
  // Вызывается после успешного входа через Apple/Google. Экрану Welcome это
  // не нужно (навигатор сам переключится на AppStack), а шторке нужно: она
  // висит в портале вне навигатора и после логина осталась бы на экране.
  onAuthenticated?: () => void;
}

/**
 * Три способа войти — Apple, Google, почта. Общий блок для WelcomeScreen и
 * шторки «нужен аккаунт» (useRequireAuth): раньше он был только на Welcome, и
 * гость, упёршийся в стену на странице птицы, до Apple/Google дотянуться уже
 * не мог — Welcome лежит под всем каталожным стеком.
 */
const AuthOptions = ({ onEmailPress, onAuthenticated }: AuthOptionsProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { showErrorToast } = useApiError();

  const [googleLoginInProgress, setGoogleLoginInProgress] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  // `auth_started` шлётся здесь, а не в util/auth.ts: там известен только
  // результат (`login`/`sign_up`), и разницу между этими двумя событиями —
  // отвал в самом провайдере, отмену системного диалога, недоступные Play
  // Services — видно только отсюда.
  const handleGoogle = async () => {
    if (googleLoginInProgress) return;
    setGoogleLoginInProgress(true);
    track("auth_started", { method: "google" });

    try {
      const result = await LoginWithGoogle();
      if (result === null) {
        showErrorToast(
          { message: "Google Play Services unavailable" } as AppError,
          "LoginWithGoogle",
        );
        return;
      }
      onAuthenticated?.();
    } catch (e) {
      const err = e as AppError;
      if (err.code !== "SIGN_IN_CANCELLED") {
        showErrorToast(err, "LoginWithGoogle");
      }
    } finally {
      setGoogleLoginInProgress(false);
    }
  };

  const handleApple = async () => {
    track("auth_started", { method: "apple" });
    try {
      await LoginWithApple();
      onAuthenticated?.();
    } catch (e) {
      const err = e as AppError;
      if (err.code !== "ERR_REQUEST_CANCELED") {
        showErrorToast(err, "LoginWithApple");
      }
    }
  };

  return (
    <View style={styles.buttons}>
      {appleAvailable && (
        <TouchableOpacity
          style={styles.button}
          onPress={handleApple}
          testID="auth-option-apple"
        >
          <Ionicons name="logo-apple" size={20} color={Colors.textMain} />
          <Text style={styles.buttonText}>{t("continue_with_apple")}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={handleGoogle}
        disabled={googleLoginInProgress}
        activeOpacity={0.7}
        testID="auth-option-google"
      >
        <Ionicons name="logo-google" size={20} color={Colors.textMain} />
        <Text style={styles.buttonText}>{t("continue_with_google")}</Text>
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("or")}</Text>
        <View style={styles.dividerLine} />
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: Colors.main100, borderColor: Colors.main100 },
        ]}
        onPress={onEmailPress}
        testID="auth-option-email"
      >
        <Ionicons name="mail-outline" size={20} color={Colors.textOpposite} />
        <Text style={[styles.buttonText, { color: Colors.textOpposite }]}>
          {t("continue_with_email")}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default AuthOptions;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    buttons: {
      gap: 12,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 0.5,
      backgroundColor: Colors.primary100,
      borderColor: Colors.border,
    },
    buttonText: {
      fontSize: 15,
      color: Colors.textMain,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginVertical: 4,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.tabBorder,
    },
    dividerText: {
      marginHorizontal: 12,
      fontSize: 13,
      color: Colors.textMiddle,
    },
  });
