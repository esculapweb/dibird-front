import { Text, Pressable, StyleSheet } from "react-native";
import { BottomSheetView } from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";

import AuthOptions from "./AuthOptions";
import AuthAgreement from "./AuthAgreement";
import { ThemeColors, useTheme } from "../../store/theme-context";

interface AuthGateSheetProps {
  dismiss: () => void;
  // Переходы на Login/Terms/Privacy — снаружи: шторка живёт в портале вне
  // навигатора и о стеке ничего не знает.
  onEmailPress: () => void;
  onOpenDocument: (screen: "Terms" | "Privacy") => void;
}

/**
 * Содержимое шторки «нужен аккаунт» (см. hooks/useRequireAuth). Мягкий
 * upsell, а не стена: гость дошёл сюда, уже посмотрев каталог, и вход
 * происходит прямо здесь — без выхода со страницы птицы.
 *
 * Всё внутри одного BottomSheetView намеренно: при `enableDynamicSizing`
 * высоту шторки задаёт последний измеренный узел, и второй такой узел рядом
 * схлопнул бы её до своей высоты — та же причина, что описана в шапке
 * TaxonFilterSheet.
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
