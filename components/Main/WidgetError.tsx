import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";

const H_PAD = 16;

interface WidgetErrorProps {
  // The widget's own heading, so a failed block still says what it was.
  title?: string;
  onRetry: () => void;
  testID?: string;
}

// Dashboard widgets used to return null whenever their query failed, so a
// dropped connection quietly ate half the screen with nothing to tap. This
// keeps the block on screen, named, with a way to try again.
const WidgetError = ({ title, onRetry, testID }: WidgetErrorProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.wrapper}>
      {!!title && <Text style={styles.title}>{title}</Text>}

      <TouchableOpacity
        style={styles.card}
        onPress={onRetry}
        activeOpacity={0.7}
        testID={testID}
      >
        <Ionicons
          name="cloud-offline-outline"
          size={18}
          color={Colors.textSecondary}
        />
        <Text style={styles.message} numberOfLines={1}>
          {t("failed_to_load_data")}
        </Text>
        <Text style={styles.retry}>{t("try_again")}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default WidgetError;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: { marginBottom: 12 },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      marginLeft: H_PAD,
      marginBottom: 8,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: H_PAD,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      backgroundColor: Colors.primary100,
    },
    message: {
      flex: 1,
      fontSize: 13,
      color: Colors.textSecondary,
    },
    retry: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.main100,
    },
  });
