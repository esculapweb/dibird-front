import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../store/theme-context";
import Layout from "../components/ui/Layout";
import Logo from "../components/ui/Logo";

const WelcomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();

  return (
    <Layout>
      <View style={[styles.container]}>
        <View style={styles.header}>
          <View style={[styles.logoBox, { backgroundColor: Colors.main20 }]}>
            <Logo withText={false} />
          </View>
          <Text style={[styles.title, { color: Colors.main100 }]}>
            {t("welcome")}
          </Text>
          <Text style={[styles.subtitle, { color: Colors.textMiddle }]}>
            {t("sign_in_or_create")}
          </Text>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: Colors.main100, borderColor: Colors.main100 },
            ]}
            onPress={() => navigation.navigate("Login")}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={Colors.textOpposite}
            />
            <Text style={[styles.buttonText, { color: Colors.textOpposite }]}>
              {t("continue_with_email")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { borderColor: Colors.border }]}
            onPress={() => {
              /* Apple Sign In */
            }}
          >
            <Ionicons name="logo-apple" size={20} color={Colors.textMain} />
            <Text style={[styles.buttonText, { color: Colors.textMain }]}>
              {t("continue_with_apple")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { borderColor: Colors.border }]}
            onPress={() => {
              /* Google OAuth */
            }}
          >
            <Ionicons name="logo-google" size={20} color={Colors.textMain} />
            <Text style={[styles.buttonText, { color: Colors.textMain }]}>
              {t("continue_with_google")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Layout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  header: {
    alignItems: "center",
    marginBottom: 68,
  },
  logoBox: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "500",
    marginBottom: 6,
  },
  subtitle: { fontSize: 14 },
  buttons: {
    gap: 10,
    marginBottom: 24,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  buttonText: {
    fontSize: 15,
  },
  footer: {
    textAlign: "center",
    fontSize: 13,
  },
});

export default WelcomeScreen;
