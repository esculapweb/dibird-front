import { StyleSheet, View, Text } from "react-native";
import { useTranslation } from "react-i18next";


const WelcomeScreen = () => {
  const { t } = useTranslation();

  return (
    <View style={styles.rootContainer}>
      <Text style={styles.title}>Welcome Screen</Text>
    </View>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
});
