import { Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { ThemeColors, useTheme } from "../../store/theme-context";
import { StyleType } from "../../types";

interface AuthAgreementProps {
  // Открыть документ. Экраны пушит вызывающий: из шторки перед переходом её
  // надо закрыть, с Welcome — просто navigate.
  onOpen: (screen: "Terms" | "Privacy") => void;
  style?: StyleType;
}

/**
 * «Продолжая, вы соглашаетесь…». Идёт рядом с [[AuthOptions]] везде, где
 * можно завести аккаунт: вход через Apple/Google уходит на бэкенд с
 * `?agree_terms=1` (util/auth.ts), так что ссылки на документы должны быть
 * на глазах и в шторке, а не только на Welcome.
 */
const AuthAgreement = ({ onOpen, style }: AuthAgreementProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <Text style={[styles.legalText, style]}>
      {t("by_continuing")}{" "}
      <Text style={styles.legalLink} onPress={() => onOpen("Terms")}>
        {t("terms_of_service_")}
      </Text>{" "}
      {t("and")}{" "}
      <Text style={styles.legalLink} onPress={() => onOpen("Privacy")}>
        {t("privacy_policy_")}
      </Text>
    </Text>
  );
};

export default AuthAgreement;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    legalText: {
      textAlign: "center",
      fontSize: 12,
      lineHeight: 18,
      paddingHorizontal: 8,
      color: Colors.textMiddle,
    },
    legalLink: {
      textDecorationLine: "underline",
      color: Colors.main100,
    },
  });
