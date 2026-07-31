import { Text, Pressable, StyleSheet } from "react-native";
import { BottomSheetView } from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";

import AuthOptions from "./AuthOptions";
import AuthAgreement from "./AuthAgreement";
import { ThemeColors, useTheme } from "../../store/theme-context";

interface AuthGateSheetProps {
  dismiss: () => void;
  // Navigation to Login/Terms/Privacy happens outside: the sheet lives in a
  // portal outside the navigator and knows nothing about the stack.
  onEmailPress: () => void;
  onOpenDocument: (screen: "Terms" | "Privacy") => void;
}

/**
 * Contents of the "account required" sheet (see hooks/useRequireAuth). A soft
 * upsell rather than a wall: the guest got here having already browsed the
 * catalogue, and signing in happens right here — without leaving the bird page.
 *
 * Everything inside a single BottomSheetView on purpose: with
 * `enableDynamicSizing` the height of the sheet is set by the last measured
 * node, and a second such node next to it would collapse the sheet to its own
 * height — the same reason described in the header of TaxonFilterSheet.
 */
const AuthGateSheet = ({
  dismiss,
  onEmailPress,
  onOpenDocument,
}: AuthGateSheetProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <BottomSheetView style={styles.container}>
      <Text style={styles.title}>{t("auth_required_title")}</Text>
      <Text style={styles.description}>{t("auth_required_message")}</Text>

      <AuthOptions onEmailPress={onEmailPress} onAuthenticated={dismiss} />

      <AuthAgreement onOpen={onOpenDocument} style={styles.agreement} />

      <Pressable
        style={styles.cancelButton}
        onPress={dismiss}
        testID="auth-gate-cancel-button"
      >
        <Text style={styles.cancelText}>{t("cancel")}</Text>
      </Pressable>
    </BottomSheetView>
  );
};

export default AuthGateSheet;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 32,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      textAlign: "center",
      marginBottom: 8,
      color: Colors.textMain,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: 20,
      color: Colors.textMiddle,
    },
    agreement: {
      marginTop: 16,
    },
    cancelButton: {
      alignItems: "center",
      paddingVertical: 14,
      marginTop: 4,
    },
    cancelText: {
      fontSize: 15,
      color: Colors.textSecondary,
    },
  });
