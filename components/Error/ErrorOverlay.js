import { StyleSheet, Text, View, Button } from "react-native";
import { useTranslation } from "react-i18next";

import Logo from "../ui/Logo";

const ErrorOverlay = ({ title, message, onPress, logo }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.rootContainer}>
      {logo && <Logo style={styles.logo} />}
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageDescription}>{message}</Text>
      <View style={styles.buttonWrapper}>
        <Button title={t("try_again")} onPress={onPress} />
      </View>
    </View>
  );
};

export default ErrorOverlay;

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
