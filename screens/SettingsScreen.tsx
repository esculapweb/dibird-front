import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Share,
  Switch,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import Layout from "../components/ui/Layout";
import { ThemeColors, useTheme } from "../store/theme-context";
import { useProfile } from "../store/profile-context";
import { useAuth } from "../store/auth-context";
import { useOnboarding } from "../store/onboarding-context";
import {
  AppDrawerNavigationProp,
  IconType,
  ErrorExtractor,
  AppError,
} from "../types";
import { Config } from "../constants/config";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import { useExportProfile } from "../hooks/Profile/useExportProfile";
import { useBiometricSetting } from "../hooks/useBiometricSetting";
import { canUseBiometrics } from "../services/bio";
import { openSupportEmail } from "../util/openSupportEmail";
import { BottomSheet } from "../services/bottomSheet";
import { deleteMyProfile } from "../util/fetches";
import { useApiError } from "../hooks/useApiError";
import { getFullVersion } from "../util/helpers";
import api from "../services/api";
import { logError } from "../services/errors";
import { track } from "../services/analytics";

interface RowSwitchProps {
  icon: IconType;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof stylesFn>;
}

const RowSwitch = ({
  icon,
  label,
  value,
  onValueChange,
  disabled = false,
  colors,
  styles,
}: RowSwitchProps) => (
  <View style={[styles.row, disabled && styles.rowDisabled]}>
    <Ionicons name={icon} size={18} color={colors.main100} />
    <Text
      style={[styles.rowLabel, { color: colors.textMain }]}
      numberOfLines={1}
    >
      {label}
    </Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: colors.main100 }}
      thumbColor={Platform.OS === "android" ? colors.primary100 : undefined}
    />
  </View>
);

interface RowProps {
  icon: IconType;
  label: string;
  onPress?: () => void;
  rightLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  hideChevron?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof stylesFn>;
}

const Row = ({
  icon,
  label,
  onPress,
  rightLabel,
  danger = false,
  disabled = false,
  hideChevron = false,
  colors,
  styles,
}: RowProps) => {
  const labelColor = danger ? colors.error600 : colors.textMain;
  const iconColor = danger ? colors.error600 : colors.main100;

  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.55}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.rowLabel, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {rightLabel ? (
          <Text style={[styles.rowRightLabel, { color: colors.textSecondary }]}>
            {rightLabel}
          </Text>
        ) : null}
        {!hideChevron && (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textSecondary}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const Divider = ({ styles }: { styles: ReturnType<typeof stylesFn> }) => (
  <View style={styles.divider} />
);

interface SectionProps {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof stylesFn>;
  colors: ThemeColors;
}

const Section = ({ title, children, styles, colors }: SectionProps) => (
  <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
      {title}
    </Text>
    <View style={[styles.sectionCard, { backgroundColor: colors.primary100 }]}>
      {children}
    </View>
  </View>
);

const APP_REVIEW_PROFILE_ID = 9386;

const SettingsScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { showErrorToast } = useApiError();
  const { logout } = useAuth();
  const { profile } = useProfile();
  const navigation = useNavigation<AppDrawerNavigationProp>();
  const { state: exportState, triggerExport, cleanup } = useExportProfile();

  const { status: onboardingStatus, restart: restartOnboarding } =
    useOnboarding();

  const userEmail = profile?.user_data?.email ?? "";

  // Тот же гейт, что у «Send test push»: отладочные строки видны только на
  // ревью-аккаунте и на первом.
  const isDebugProfile =
    profile?.user === APP_REVIEW_PROFILE_ID || profile?.user === 1;

  // `restart()` только возвращает экран в навигатор, а объявлен он перед
  // текущим маршрутом, не поверх него — само по себе это никуда не переводит.
  // Уводить приходится отсюда и обязательно следующим рендером: `navigate` в
  // том же обработчике улетел бы в стек, где экрана ещё нет, и был бы
  // отброшен как необработанный.
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
    // Шторка закрывается до логаута, а не штатным `dismiss()` после
    // `onConfirm`: тот пришёлся бы ровно на тик, в котором навигатор меняет
    // AppStack на AuthStack, и анимация закрытия терялась — шторка оставалась
    // висеть поверх Welcome. Хост шторки живёт выше навигатора (App.tsx) и
    // логаут переживает, так что сама она не размонтируется.
    BottomSheet.hide();
    await logout();
  };

  const handleTestPush = async () => {
    try {
      await api.post("/myapi/notifications/test-push/");
      Alert.alert("OK", "Push sent");
    } catch (e) {
      const error = e as AppError;
      logError(error, "ConfirmEmail API ERROR");
      Alert.alert("Error", "Could not send push");
    }
  };

  const extractDeleteError: ErrorExtractor = (err) => ({
    title: t("delete_failed"),
    message: err?.response?.data?.detail ?? t("could_not_delete_profile"),
  });

  const handleTellAFriend = async () => {
    track("share_tapped", { type: "app" });
    await Share.share(
      Platform.OS === "ios"
        ? {
            url: `${Config.baseUrl}/`,
            message: t("tell_a_friend_message"),
          }
        : { message: t("tell_a_friend_message") },
    );
  };

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
    <Layout
      withScroll
      contentContainerStyle={styles.scroll}
      bottom={
        <FlatButtonBottom textColor={Colors.textSecondary} disabled>
          {t("app_version", { version: getFullVersion() })}
        </FlatButtonBottom>
      }
    >
      <Section
        title={t("settings_section_alerts")}
        styles={styles}
        colors={Colors}
      >
        <Row
          icon="notifications-outline"
          label={t("alert_settings")}
          onPress={() => navigation.navigate("AlertSettings")}
          colors={Colors}
          styles={styles}
        />
        {isDebugProfile && (
          <Row
            icon="notifications-outline"
            label="Send test push"
            onPress={handleTestPush}
            colors={Colors}
            styles={styles}
          />
        )}
      </Section>

      {bioAvailable && (
        <Section
          title={t("settings_section_security")}
          styles={styles}
          colors={Colors}
        >
          <RowSwitch
            icon="finger-print-outline"
            label={t("settings_biometric_lock")}
            value={biometricEnabled}
            onValueChange={toggleBiometric}
            disabled={bioLoading}
            colors={Colors}
            styles={styles}
          />
        </Section>
      )}

      <Section
        title={t("settings_section_data")}
        styles={styles}
        colors={Colors}
      >
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
          colors={Colors}
          styles={styles}
        />
        <Divider styles={styles} />
        <Row
          icon="cloud-upload-outline"
          label={t("import_data")}
          onPress={() => navigation.navigate("Import")}
          colors={Colors}
          styles={styles}
        />
      </Section>

      <Section
        title={t("settings_section_about")}
        styles={styles}
        colors={Colors}
      >
        <Row
          icon="share-social-outline"
          label={t("settings_tell_a_friend")}
          onPress={handleTellAFriend}
          hideChevron
          colors={Colors}
          styles={styles}
        />
        <Divider styles={styles} />
        <Row
          icon="chatbubble-outline"
          label={t("settings_send_feedback")}
          onPress={openSupportEmail}
          hideChevron
          colors={Colors}
          styles={styles}
        />
        <Divider styles={styles} />
        <Row
          icon="shield-checkmark-outline"
          label={t("privacy_policy")}
          onPress={() => navigation.navigate("Privacy")}
          colors={Colors}
          styles={styles}
        />
        <Divider styles={styles} />
        <Row
          icon="document-text-outline"
          label={t("terms_of_service")}
          onPress={() => navigation.navigate("Terms")}
          colors={Colors}
          styles={styles}
        />
      </Section>

      {/* Без i18n намеренно, как и «Send test push»: строка не попадает
          обычному пользователю и переводить её незачем. */}
      {isDebugProfile && (
        <Section title="Debug" styles={styles} colors={Colors}>
          <Row
            icon="refresh-outline"
            label="Replay onboarding"
            onPress={restartOnboarding}
            hideChevron
            colors={Colors}
            styles={styles}
          />
        </Section>
      )}

      <Section
        title={t("settings_section_danger")}
        styles={styles}
        colors={Colors}
      >
        <Row
          icon="trash-outline"
          label={t("delete_profile")}
          onPress={handleShowBottomSheet}
          danger
          hideChevron
          colors={Colors}
          styles={styles}
        />
      </Section>
    </Layout>
  );
};

export default SettingsScreen;

// ------------------------------------------------------------------
// Styles
// ------------------------------------------------------------------

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: 16,
    },
    section: {
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      marginBottom: 6,
      marginLeft: 2,
    },
    sectionCard: {
      borderRadius: 14,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
    },
    rowDisabled: {
      opacity: 0.35,
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
    },
    rowDescription: {
      fontSize: 12,
      marginTop: 1,
      lineHeight: 16,
    },
    rowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    rowRightLabel: {
      fontSize: 14,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Colors.border,
      marginLeft: 44,
      marginRight: 16,
    },
    version: {
      textAlign: "center",
      fontSize: 12,
      color: Colors.textSecondary,
      opacity: 0.5,
    },
  });
