import { StyleSheet, Text, View, Button } from "react-native";
import { useTranslation } from "react-i18next";

import { useProfile } from "../store/profile-context";
import { mapErrorToToast } from "../services/api";
import Logo from "../components/ui/Logo";

const ErrorScreen = () => {
  const { t } = useTranslation();
  const { error, refreshProfile } = useProfile();

  const {title, message} = mapErrorToToast(error);

  return (
    <View style={styles.rootContainer}>
      <Logo style={styles.logo} />
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageDescription}>{message}</Text>
      <View style={styles.buttonWrapper}>
        <Button
          title={t("try_again")}
          onPress={refreshProfile}
        />
      </View>
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
