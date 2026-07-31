import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as DocumentPicker from "expo-document-picker";

import Layout from "../components/ui/Layout";
import AnimatedLoadingButton from "../components/ui/AnimatedLoadingButton";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useImportObservations } from "../hooks/Profile/useImportObservations";
import { logError } from "../services/errors";

const EBIRD_DOWNLOAD_URL = "https://ebird.org/downloadMyData";


/**
 * Importing a life list from eBird — a switching feature: people stay with a
 * competitor not because it is better there, but because ten years of their data
 * are there.
 *
 * The parsing happens on the backend in celery, so the screen is a file picker
 * plus polling of the status (`useImportObservations`, the structure repeats
 * [useExportProfile](../hooks/Profile/useExportProfile.ts)).
 */
const ImportScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const { state, result, startImport, reset } = useImportObservations();
  const [makePublic, setMakePublic] = useState(false);

  const running = state === "pending" || state === "processing";

  // Already translated strings rather than keys: i18next-parser only parses
  // literal calls, and with a variable instead of a key (as with a template
  // string) it creates an empty key `"": ""` — that one would beat the fallback
  // and leave the string blank in the UI, exactly what CLAUDE.md forbids. For the
  // same reason an example of such a call must not be written here even in a
  // comment: the parser reads keys out of those too.
  const steps = [
    t("import_how_step_1"),
    t("import_how_step_2"),
    t("import_how_step_3"),
  ];

  const handlePick = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // On Android some file managers hand a CSV over as */* or
        // application/octet-stream, so the type is not narrowed down to text/csv —
        // the extension is checked by the backend anyway.
        type: ["text/csv", "text/comma-separated-values", "*/*"],
        copyToCacheDirectory: true,
      });

      if (picked.canceled) return;

      const asset = picked.assets[0];
      if (!asset) return;

      await startImport(
        { uri: asset.uri, name: asset.name || "ebird.csv" },
        makePublic,
      );
    } catch (e) {
      logError(e, "ImportScreen:pick");
    }
  };

  const renderIdle = () => (
    <>
      <View style={styles.steps}>
        <Text style={styles.stepsTitle}>{t("import_how_title")}</Text>
        {steps.map((step, i) => (
          <View key={step} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
        <Text
          style={styles.link}
          onPress={() => Linking.openURL(EBIRD_DOWNLOAD_URL)}
          testID="import-ebird-link"
        >
          {EBIRD_DOWNLOAD_URL}
        </Text>
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchLabels}>
          <Text style={styles.switchTitle}>{t("import_public_title")}</Text>
          <Text style={styles.switchText}>{t("import_public_text")}</Text>
        </View>
        <Switch
          value={makePublic}
          onValueChange={setMakePublic}
          trackColor={{ false: Colors.border, true: Colors.main100 }}
          testID="import-public-switch"
        />
      </View>
    </>
  );

  const renderRunning = () => (
    <View style={styles.center} testID="import-progress">
      <ActivityIndicator size="large" color={Colors.main100} />
      <Text style={styles.centerTitle}>{t("import_in_progress_title")}</Text>
      {/* Leaving the screen is fine: the task lives on the backend, and the
          polling picks it back up via a 429 on the next visit. */}
      <Text style={styles.centerText}>{t("import_in_progress_text")}</Text>
    </View>
  );

  const renderDone = () => (
    <View style={styles.center} testID="import-result">
      <Ionicons name="checkmark-circle" size={64} color={Colors.main100} />
      <Text style={styles.centerTitle}>{t("import_done_title")}</Text>
      <Text style={styles.centerText}>
        {t("import_done_text", {
          imported: result?.imported ?? 0,
          total: result?.total ?? 0,
        })}
      </Text>

      {!!result?.unmatched.length && (
        <View style={styles.unmatched}>
          <Text style={styles.unmatchedTitle}>
            {t("import_unmatched_title")}
          </Text>
          <Text style={styles.unmatchedText}>{t("import_unmatched_text")}</Text>
          {result.unmatched.map((name) => (
            <Text key={name} style={styles.unmatchedItem}>
              {name}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  const renderFailed = () => (
    <View style={styles.center} testID="import-failed">
      <Ionicons name="alert-circle" size={64} color={Colors.error600} />
      <Text style={styles.centerTitle}>{t("import_failed_title")}</Text>
      <Text style={styles.centerText}>{t("import_failed_text")}</Text>
    </View>
  );

  return (
    <Layout>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{t("import_title")}</Text>
        <Text style={styles.text}>{t("import_text")}</Text>

        {state === "idle" && renderIdle()}
        {running && renderRunning()}
        {state === "completed" && renderDone()}
        {state === "failed" && renderFailed()}
      </ScrollView>

      {!running && (
        <View style={styles.footer}>
          <AnimatedLoadingButton
            onPress={state === "idle" ? handlePick : reset}
            loading={false}
            testID="import-action"
          >
            {state === "idle" ? t("import_pick_file") : t("done")}
          </AnimatedLoadingButton>
        </View>
      )}
    </Layout>
  );
};

export default ImportScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: "600",
      color: Colors.textMain,
      marginBottom: 8,
    },
    text: {
      fontSize: 14,
      lineHeight: 20,
      color: Colors.textSecondary,
      marginBottom: 24,
    },
    steps: {
      padding: 16,
      borderRadius: 14,
      backgroundColor: Colors.primary100,
      marginBottom: 20,
    },
    stepsTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      marginBottom: 12,
    },
    step: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 10,
    },
    stepNum: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.main300,
    },
    stepNumText: {
      fontSize: 12,
      fontWeight: "700",
      color: Colors.main100,
    },
    stepText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 19,
      color: Colors.textSecondary,
    },
    link: {
      fontSize: 13,
      color: Colors.main100,
      marginTop: 4,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    switchLabels: { flex: 1 },
    switchTitle: {
      fontSize: 15,
      color: Colors.textMain,
      marginBottom: 3,
    },
    switchText: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
    },
    center: {
      alignItems: "center",
      paddingVertical: 24,
      gap: 12,
    },
    centerTitle: {
      fontSize: 18,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
    },
    centerText: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      color: Colors.textSecondary,
    },
    unmatched: {
      alignSelf: "stretch",
      padding: 14,
      borderRadius: 12,
      backgroundColor: Colors.primary100,
      marginTop: 8,
    },
    unmatchedTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
      marginBottom: 4,
    },
    unmatchedText: {
      fontSize: 13,
      lineHeight: 18,
      color: Colors.textSecondary,
      marginBottom: 8,
    },
    unmatchedItem: {
      fontSize: 13,
      fontStyle: "italic",
      color: Colors.textSecondary,
    },
    footer: {
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
  });
