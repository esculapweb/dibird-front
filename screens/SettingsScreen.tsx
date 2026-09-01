import { useEffect, useState } from "react";
import { StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";

import Layout from "../components/ui/Layout";
import { Row, RowSwitch, Section } from "../components/Settings/SettingsList";
import LanguageSwitcher from "../components/Language/LanguageSwitcher";
import ThemeSwitcher from "../components/Theme/ThemeSwitcher";
import { useProfile } from "../store/profile-context";
import { useAuth } from "../store/auth-context";
import { useOnboarding } from "../store/onboarding-context";
import {
  AppDrawerNavigationProp,
  ErrorExtractor,
  AppError,
} from "../types";
import { useExportProfile } from "../hooks/Profile/useExportProfile";
import { useBiometricSetting } from "../hooks/useBiometricSetting";
import { canUseBiometrics } from "../services/bio";
import { BottomSheet } from "../services/bottomSheet";
import { deleteMyProfile } from "../util/fetches";
import { useApiError } from "../hooks/useApiError";
import api from "../services/api";
import { logError } from "../services/errors";

const APP_REVIEW_PROFILE_ID = 9386;
// The e2e accounts — one per platform, so that the iOS and Android batches can
// be run at the same time without sharing data (see `.maestro/run.sh`). They need
// the gate for "Replay onboarding": without it there is nothing to start
// `.maestro/onboarding.yaml` with — the real flag is only set by a signup.
const TEST_IOS_PROFILE_ID = 8262;
const TEST_ANDROID_PROFILE_ID = 8263;

const SettingsScreen = () => {
  const { t } = useTranslation();
  const { showErrorToast } = useApiError();
  const { logout } = useAuth();
  const { profile } = useProfile();
  const navigation = useNavigation<AppDrawerNavigationProp>();
  const { state: exportState, triggerExport, cleanup } = useExportProfile();

  const { status: onboardingStatus, restart: restartOnboarding } =
    useOnboarding();

  const userEmail = profile?.user_data?.email ?? "";

  // The gate for the whole Debug section: it is visible only on the review
  // account, on the e2e accounts and on the first one. Every id is compared
  // separately — a bare constant in a `||` chain is always truthy and would open
  // the section (and the auto-jump into onboarding below) to absolutely
  // everyone.
  const isDebugProfile =
    profile?.user === APP_REVIEW_PROFILE_ID ||
    profile?.user === TEST_IOS_PROFILE_ID ||
    profile?.user === TEST_ANDROID_PROFILE_ID ||
    profile?.user === 1;

  // `restart()` only returns the screen into the navigator, and it is declared
  // before the current route rather than on top of it — on its own that navigates
  // nowhere. The navigation has to happen from here and necessarily on the next
  // render: a `navigate` in the same handler would fly into a stack that does not
  // have the screen yet and would be dropped as unhandled.
  useEffect(() => {
    if (isDebugProfile && onboardingStatus === "needed")
      navigation.navigate("Onboarding");
  }, [isDebugProfile, onboardingStatus]);

  const {
    isEnabled: biometricEnabled,
    isLoading: bioLoading,
    toggle: toggleBiometric,
  } = useBiometricSetting();
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    canUseBiometrics().then(setBioAvailable);
  }, []);

  const handleDeleteConfirmed = async () => {
    const status = await deleteMyProfile(userEmail);
    if (status !== 204) return;
    // The sheet is closed before the logout rather than by the regular
    // `dismiss()` after `onConfirm`: that one would land exactly on the tick in
    // which the navigator swaps AppStack for AuthStack, and the closing animation
    // got lost — the sheet stayed hanging above Welcome. The host of the sheet
    // lives above the navigator (App.tsx) and survives the logout, so the sheet
    // itself does not unmount.
    BottomSheet.hide();
    await logout();
  };

  const handleTestPush = async () => {
    try {
      await api.post("/myapi/notifications/test-push/");
      Alert.alert("OK", "Push sent");
    } catch (e) {
      const error = e as AppError;
      logError(error, "TEST PUSH API ERROR");
      Alert.alert("Error", "Could not send push");
    }
  };

  const extractDeleteError: ErrorExtractor = (err) => ({
    title: t("delete_failed"),
    message: err?.response?.data?.detail ?? t("could_not_delete_profile"),
  });

  const handleShowBottomSheet = () =>
    BottomSheet.show({
      title: t("delete_profile_title"),
      description: t("delete_profile_warning"),
      confirmText: t("delete_confirm_button"),
      cancelText: t("cancel"),
      danger: true,
      requiredInput: userEmail,
      inputPlaceholder: userEmail,
      inputLabel: t("delete_profile_input_label"),
      onConfirm: handleDeleteConfirmed,
      onError: (e) => showErrorToast(e, "deleteMyProfile", extractDeleteError),
    });

  const isExporting = exportState === "pending" || exportState === "processing";
  useEffect(() => () => cleanup(), []);

  const handleExportPress = () =>
    BottomSheet.show({
      title: t("export_data"),
      description: t("export_data_confirm_description"),
      confirmText: t("export_data_confirm_button"),
      cancelText: t("cancel"),
      onConfirm: triggerExport,
    });

  return (
    <Layout withScroll contentContainerStyle={styles.scroll}>
      {/* Everything tied to the account itself: who I am, how I sign in, and who
          I have shut out. The password and the biometric lock used to be a
          "Security" section of their own, but both are just ways into this one
          account, and a section per row is what made the screen sprawl. */}
      <Section title={t("settings_section_account")}>
        <Row
          icon="person-circle-outline"
          label={t("profile")}
          onPress={() => navigation.navigate("Profile")}
        />
        <Row
          icon="at-outline"
          label={t("emails_title")}
          onPress={() => navigation.navigate("Emails")}
        />
        <Row
          icon="link-outline"
          label={t("linked_accounts_title")}
          onPress={() => navigation.navigate("LinkedAccounts")}
        />
        <Row
          icon="key-outline"
          label={t("change_password")}
          onPress={() => navigation.navigate("ChangePassword")}
        />
        {/* The switch depends on the device having a sensor enrolled; the rows
            around it belong to everyone. */}
        {bioAvailable && (
          <RowSwitch
            icon="finger-print-outline"
            label={t("settings_biometric_lock")}
            value={biometricEnabled}
            onValueChange={toggleBiometric}
            disabled={bioLoading}
          />
        )}
        {/* Blocking has to be undoable somewhere, and this is the only screen
            that outlives the profile it was made on. */}
        <Row
          icon="ban-outline"
          label={t("blocked_users")}
          onPress={() => navigation.navigate("BlockedUsers")}
        />
      </Section>

      <Section title={t("settings_section_alerts")}>
        <Row
          icon="notifications-outline"
          label={t("alert_settings")}
          onPress={() => navigation.navigate("AlertSettings")}
        />
      </Section>

      {/* Both switchers are also in the drawer footer, deliberately: the drawer
          keeps them one tap away, and this is where people go looking for them.
          They share the state (language-context / theme-context), so the two
          copies can never disagree. */}
      <Section title={t("settings_section_appearance")}>
        <LanguageSwitcher variant="settings" />
        <ThemeSwitcher variant="settings" />
      </Section>

      <Section title={t("settings_section_data")}>
        <Row
          icon="download-outline"
          label={
            isExporting
              ? t("export_data_in_progress")
              : exportState === "completed"
                ? t("export_data_done")
                : exportState === "failed"
                  ? t("export_data_failed")
                  : t("export_data")
          }
          onPress={isExporting ? undefined : handleExportPress}
          disabled={isExporting}
          hideChevron
        />
        <Row
          icon="cloud-upload-outline"
          label={t("import_data")}
          onPress={() => navigation.navigate("Import")}
        />
      </Section>

      {/* Untitled: a lone row into the About screen, which has no group of its
          own to head. */}
      <Section>
        <Row
          icon="information-circle-outline"
          label={t("settings_section_about")}
          onPress={() => navigation.navigate("About")}
        />
      </Section>

      {/* Deliberately without i18n: these strings never reach an ordinary user
          and there is no point translating them. */}
      {isDebugProfile && (
        <Section title="Debug">
          <Row
            icon="notifications-outline"
            label="Send test push"
            onPress={handleTestPush}
            hideChevron
          />
          <Row
            icon="refresh-outline"
            label="Replay onboarding"
            onPress={restartOnboarding}
            hideChevron
          />
        </Section>
      )}

      <Section title={t("settings_section_danger")}>
        <Row
          icon="trash-outline"
          label={t("delete_profile")}
          onPress={handleShowBottomSheet}
          danger
          hideChevron
        />
      </Section>
    </Layout>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
