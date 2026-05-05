import { useLayoutEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Share,
  Linking,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

import api, { clearTokens, showError } from "../services/api";
import Layout from "../components/ui/Layout";
import ConfirmBottomSheet, {
  ConfirmBottomSheetRef,
} from "../components/ui/ConfirmBottomSheet";
import { useFilters } from "../store/filters-context";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeColors, useTheme } from "../store/theme-context";
import { useProfile } from "../store/profile-context";
import { useAuth } from "../store/auth-context";
import {
  AppError,
  AppDrawerNavigationProp,
  RootStackNavigationProp,
  IconType,
} from "../types";
import { Config } from "../constants/config";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";

// ------------------------------------------------------------------
// Primitives
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Screen
// ------------------------------------------------------------------

const SettingsScreen = () => {
  const headerHeight = useHeaderHeight();
  const { resetFilters } = useFilters();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { logout } = useAuth();
  const { profile } = useProfile();
  const navigation = useNavigation<AppDrawerNavigationProp>();
  const rootNavigation = useNavigation<RootStackNavigationProp>();

  const version = Constants.expoConfig?.version ?? "—";
  const build =
    Constants.expoConfig?.ios?.buildNumber ??
    String(Constants.expoConfig?.android?.versionCode ?? "");
  const fullVersion = build ? `${version} (${build})` : version;

  const userEmail = profile?.user_data?.email ?? "";

  const deleteSheetRef = useRef<ConfirmBottomSheetRef>(null);
  const iconName: IconType =
    Platform.OS === "ios" ? "chevron-back" : "arrow-back";

  const clearAll = async () => {
    await clearTokens();
    await AsyncStorage.multiRemove(["profile", "filters", "sorting", "global"]);
    await resetFilters();
    queryClient.clear();
  };

  const handleDeleteConfirmed = async () => {
    const res = await api.delete("/myapi/profile/delete-me/");
    if (res?.status === 204) {
      await clearAll();
      await logout();
    }
  };

  const extractDeleteError = (e: AppError) => ({
    title: t("delete_failed"),
    message: e?.response?.data?.detail ?? t("could_not_delete_profile"),
  });

  const handleTellAFriend = async () => {
    await Share.share(
      Platform.OS === "ios"
        ? {
            url: `${Config.baseUrl}/`,
            message: t("tell_a_friend_message"),
          }
        : { message: t("tell_a_friend_message") },
    );
  };

  const handleFeedback = () => {
    Linking.openURL(`mailto:${Config.email}`);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("MainDrawer")}
          style={{ padding: 8 }}
          hitSlop={8}
        >
          <Ionicons name={iconName} size={24} color={Colors.textMain} />
        </TouchableOpacity>
      ),
      headerLeftContainerStyle: {
        paddingLeft: Platform.OS === "android" ? 8 : 0,
      },
    });
  }, [navigation, Colors, iconName]);

  return (
    <Layout
      withScroll
      contentContainerStyle={[styles.scroll, { paddingTop: headerHeight + 16 }]}
      bottom={
        <FlatButtonBottom textColor={Colors.textSecondary} disabled>
          {t("app_version", { version: fullVersion })}
        </FlatButtonBottom>
      }
    >
      {/* ── About ────────────────────────────────────────── */}
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
          onPress={handleFeedback}
          hideChevron
          colors={Colors}
          styles={styles}
        />
        <Divider styles={styles} />
        <Row
          icon="shield-checkmark-outline"
          label={t("privacy_policy")}
          onPress={() => rootNavigation.navigate("Privacy")}
          colors={Colors}
          styles={styles}
        />
        <Divider styles={styles} />
        <Row
          icon="document-text-outline"
          label={t("terms_of_service")}
          onPress={() => rootNavigation.navigate("Terms")}
          colors={Colors}
          styles={styles}
        />
      </Section>

      {/* ── Data ─────────────────────────────────────────── */}
      <Section
        title={t("settings_section_data")}
        styles={styles}
        colors={Colors}
      >
        <Row
          icon="download-outline"
          label={t("export_data")}
          disabled
          colors={Colors}
          styles={styles}
        />
        <Divider styles={styles} />
        <Row
          icon="cloud-upload-outline"
          label={t("import_data")}
          disabled
          colors={Colors}
          styles={styles}
        />
      </Section>

      {/* ── Danger zone ──────────────────────────────────── */}
      <Section
        title={t("settings_section_danger")}
        styles={styles}
        colors={Colors}
      >
        <Row
          icon="trash-outline"
          label={t("delete_profile")}
          onPress={() => deleteSheetRef.current?.present(null)}
          danger
          hideChevron
          colors={Colors}
          styles={styles}
        />
      </Section>

      <ConfirmBottomSheet
        ref={deleteSheetRef}
        danger
        title={t("delete_profile_title")}
        description={t("delete_profile_warning")}
        confirmText={t("delete_confirm_button")}
        cancelText={t("cancel")}
        requiredInput={userEmail}
        inputPlaceholder={userEmail}
        inputLabel={t("delete_profile_input_label")}
        onConfirm={handleDeleteConfirmed}
        onError={(e) => showError(e as AppError, extractDeleteError)}
      />
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
