import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";

/**
 * Экран ценности: иконка, заголовок, две строки текста. Реальных скриншотов
 * приложения в репозитории нет, поэтому пока иконка — когда появятся ассеты
 * для ASO, она меняется на картинку без правки потока.
 */
const OnboardingValueStep = ({
  icon,
  title,
  text,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  testID?: string;
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={54} color={Colors.main100} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
};

export default OnboardingValueStep;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    iconCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.main300,
      marginBottom: 32,
    },
    title: {
      fontSize: 22,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
      marginBottom: 12,
    },
    text: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      color: Colors.textSecondary,
    },
  });
