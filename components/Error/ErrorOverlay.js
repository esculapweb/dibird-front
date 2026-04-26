import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import Logo from "../ui/Logo";
import { useTheme, ThemeColors } from "../../store/theme-context";
import FlatButton from "../ui/FlatButton";

const ErrorOverlay = ({ title, message, onPress, logo }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.rootContainer}>
      {logo && <Logo style={styles.logo} />}
      <Text style={styles.messageTitle}>{title}</Text>
      <Text style={styles.messageDescription}>{message}</Text>
      <View style={styles.buttonWrapper}>
        <FlatButton onPress={onPress} >{t("try_again")}</FlatButton>
      </View>
    </View>
  );
};

export default ErrorOverlay;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    rootContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    messageTitle: {
      color: Colors.textMain,
      fontSize: 16,
      fontWeight: "600",
    },
    messageDescription: {
      color: Colors.textMain,
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
