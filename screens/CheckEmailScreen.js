import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../store/theme-context";
import Layout from "../components/ui/Layout";
import Logo from "../components/ui/Logo";

const CheckEmailScreen = ({ route, navigation }) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);
  const email = route.params?.email;

  if (!email) return;

  return (
    <Layout>
      <View style={styles.container}>
        <Logo />
        <Text style={styles.title}>{t("confirmation_sent_to", { email })}</Text>
        <Text style={styles.subtitle}>{t("verification_sent")}</Text>
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
      padding: 32,
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
