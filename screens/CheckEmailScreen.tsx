import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRoute } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../store/theme-context";
import Layout from "../components/ui/Layout";
import Logo from "../components/ui/Logo";
import { AuthStackRouteProp } from "../types";
import { openSupportEmail } from "../util/openSupportEmail";

const CheckEmailScreen = () => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const route = useRoute<AuthStackRouteProp<"CheckEmail">>();
  const styles = stylesFn(Colors);
  const email = route.params?.email;

  if (!email) return null;

  return (
    <Layout>
      <View style={styles.container}>
        <Logo />
        <Text style={styles.title}>{t("confirmation_sent_to", { email })}</Text>
        <Text style={styles.subtitle}>
          {t("verification_sent_before")}
          <Text
            style={{ color: Colors.main100, textDecorationLine: "underline" }}
            onPress={openSupportEmail}
          >
            {t("verification_sent_link")}
          </Text>
          {t("verification_sent_after")}
        </Text>
      </View>
    </Layout>
  );
};

export default CheckEmailScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 32,
    },
    title: {
      marginTop: 24,
      fontSize: 18,
      fontWeight: "700",
      textAlign: "center",
      color: Colors.textMain,
    },
    subtitle: {
      marginVertical: 24,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
      color: Colors.textSecondary,
    },
  });
