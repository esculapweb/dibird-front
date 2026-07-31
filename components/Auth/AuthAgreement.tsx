import { Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import { ThemeColors, useTheme } from "../../store/theme-context";
import { StyleType } from "../../types";

interface AuthAgreementProps {
  // Open a document. The caller pushes the screens: from the sheet it has to be
  // dismissed first, from Welcome it is a plain navigate.
  onOpen: (screen: "Terms" | "Privacy") => void;
  style?: StyleType;
}

/**
 * "By continuing, you agree…". Sits next to [[AuthOptions]] everywhere an
 * account can be created: Apple/Google sign-in goes to the backend with
 * `?agree_terms=1` (util/auth.ts), so links to the documents must be in plain
 * sight in the sheet as well, not only on Welcome.
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
