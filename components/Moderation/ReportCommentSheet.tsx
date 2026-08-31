import { useState } from "react";
import { Text, Pressable, StyleSheet, Platform } from "react-native";
import { BottomSheetTextInput, BottomSheetView } from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";

import { ThemeColors, useTheme } from "../../store/theme-context";

// Same cap the server puts on ContentReportSerializer.comment. Enforced here
// too, so a long text is trimmed while it is being written rather than coming
// back as a 400 once the sheet has already closed.
const MAX_LENGTH = 1000;

interface ReportCommentSheetProps {
  dismiss: () => void;
  onSubmit: (comment: string) => void;
}

/**
 * The "Something else" branch of a report.
 *
 * A reason picked from the list speaks for itself; this one does not — an
 * empty "other" tells the moderator nothing at all, and the DSA's
 * notice-and-action rules (Art. 16) expect the person reporting to be able to
 * say why. Hence the field, and a send button that stays disabled until
 * something is actually written.
 *
 * Everything in a single BottomSheetView, like AuthGateSheet: with
 * `enableDynamicSizing` the sheet takes the height of the last measured node,
 * and a second one beside it would collapse it to that node's height.
 */
const ReportCommentSheet = ({ dismiss, onSubmit }: ReportCommentSheetProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [comment, setComment] = useState("");

  const trimmed = comment.trim();

  return (
    <BottomSheetView style={styles.container}>
      <Text style={styles.title}>{t("report_comment_title")}</Text>
      <Text style={styles.description}>{t("report_comment_message")}</Text>

      <BottomSheetTextInput
        style={styles.input}
        value={comment}
        onChangeText={setComment}
        placeholder={t("report_comment_placeholder")}
        placeholderTextColor={Colors.textSecondary}
        maxLength={MAX_LENGTH}
        multiline
        autoFocus
        testID="report-comment-input"
      />

      <Pressable
        style={[styles.primaryButton, !trimmed && styles.disabled]}
        disabled={!trimmed}
        onPress={() => onSubmit(trimmed)}
        testID="report-comment-submit"
      >
        <Text style={styles.primaryText}>{t("report_send")}</Text>
      </Pressable>

      <Pressable
        style={styles.cancelButton}
        onPress={dismiss}
        testID="report-comment-cancel"
      >
        <Text style={styles.cancelText}>{t("cancel")}</Text>
      </Pressable>
    </BottomSheetView>
  );
};

export default ReportCommentSheet;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      paddingTop: 8,
      gap: 10,
      width: "100%",
      maxWidth: 680,
    },
    title: {
      fontSize: 17,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
    },
    description: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    input: {
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 12 : 9,
      fontSize: 15,
      color: Colors.textMain,
      backgroundColor: Colors.backgroundMain,
      minHeight: 96,
      textAlignVertical: "top",
    },
    primaryButton: {
      marginTop: 6,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
      backgroundColor: Colors.main100,
    },
    disabled: {
      opacity: 0.6,
    },
    primaryText: {
      fontWeight: "600",
      fontSize: 15,
      color: Colors.textOpposite,
    },
    cancelButton: {
      paddingVertical: 12,
      alignItems: "center",
    },
    cancelText: {
      fontWeight: "500",
      fontSize: 15,
      color: Colors.textSecondary,
    },
  });
