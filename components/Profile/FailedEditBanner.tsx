import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { FailedProfileEdit } from "../../store/profile-context";

interface FailedEditBannerProps {
  failedEdit: FailedProfileEdit;
  onRetry: () => Promise<void>;
  onDiscard: () => void;
}

const FailedEditBanner = ({
  failedEdit,
  onRetry,
  onDiscard,
}: FailedEditBannerProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons name="warning-outline" size={20} color={Colors.error600} />
        <View style={styles.textWrapper}>
          <Text style={styles.title}>{t("edit_not_saved_title")}</Text>
          <Text style={styles.message}>
            {failedEdit.message || t("edit_not_saved_message")}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onDiscard} hitSlop={8}>
          <Text style={styles.discardText}>{t("discard_changes")}</Text>
        </Pressable>
        <Pressable onPress={handleRetry} hitSlop={8} disabled={retrying}>
          {retrying ? (
            <ActivityIndicator size="small" color={Colors.error600} />
          ) : (
            <Text style={styles.retryText}>{t("try_again")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

export default FailedEditBanner;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: Colors.error100,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    textWrapper: {
      flex: 1,
      marginLeft: 8,
    },
    title: {
      color: Colors.textMain,
      fontSize: 14,
      fontWeight: "600",
    },
    message: {
      color: Colors.textMain,
      opacity: 0.8,
      fontSize: 13,
      marginTop: 2,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 8,
      gap: 20,
    },
    discardText: {
      color: Colors.textMiddle,
      fontSize: 14,
      fontWeight: "600",
    },
    retryText: {
      color: Colors.error600,
      fontSize: 14,
      fontWeight: "600",
    },
  });
