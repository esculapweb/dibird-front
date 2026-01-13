import { StyleSheet, Text, View, Button } from "react-native";
import { useTranslation } from "react-i18next";

import { useProfile } from "../store/profile-context";
import { API_ERROR } from "../services/api";
import Logo from "../components/ui/Logo";

const ErrorScreen = () => {
  const { error, refreshProfile } = useProfile();
  const { t } = useTranslation();

  if (error === API_ERROR.NETWORK) {
    return (
      <View style={styles.rootContainer}>
        <Logo style={styles.logo} />
        <Text style={styles.messageTitle}>{t("unable_connect_server")}</Text>
        <Text style={styles.messageDescription}>{t("check_internet")}</Text>
        <View style={styles.buttonWrapper}>
          <Button title={t("retry")} onPress={refreshProfile} />
        </View>
      </View>
    );
  }

  if (error === API_ERROR.SERVER) {
    return (
      <View style={styles.rootContainer}>
        <Logo style={styles.logo} />
        <Text style={styles.messageTitle}>{t("server_unavailable")}</Text>
        <View style={styles.buttonWrapper}>
          <Button title={t("try_again")} onPress={refreshProfile} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rootContainer}>
      <Text style={styles.messageTitle}>{t("something_went_wrong")}</Text>
    </View>
  );
};

export default ErrorScreen;

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  messageDescription: {
    opacity: 0.7,
    marginTop: 8,
  },
  logo: {
    marginBottom: 24,
  },
  buttonWrapper: {
    marginTop: 8,
  },
});
