import { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import Toast from "react-native-toast-message";

import Layout from "../components/ui/Layout";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useApiError } from "../hooks/useApiError";
import { BottomSheet } from "../services/bottomSheet";
import { connectApple, connectGoogle } from "../util/auth";
import {
  disconnectSocialAccount,
  fetchMyProfile,
  fetchMySocialAccounts,
} from "../util/fetches";
import {
  PASSWORD_PROFILE_QUERY_KEY,
  SOCIAL_ACCOUNTS_QUERY_KEY,
} from "../constants/accountQueryKeys";
import {
  AppError,
  ErrorExtractor,
  IconType,
  Profile,
  SocialAccountItem,
  SocialProvider,
} from "../types";

const PROVIDER_ICON: Record<string, IconType> = {
  google: "logo-google",
  apple: "logo-apple",
};

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  apple: "Apple",
};

const providerLabel = (provider: string) =>
  PROVIDER_LABEL[provider] ?? provider;

/**
 * Providers connected to the account — the app's counterpart of
 * /accounts/3rdparty/ on the website.
 *
 * Only Google and Apple can be connected from here, because those are the only
 * SDKs the app carries; VK and Yandex are configured on the backend and stay
 * website-only. Both are listed all the same when already connected, so that a
 * connection made on the website is at least visible here.
 */
const LinkedAccountsScreen = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showErrorToast } = useApiError();

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: SOCIAL_ACCOUNTS_QUERY_KEY,
    queryFn: fetchMySocialAccounts,
    staleTime: 0,
  });

  // Only for the warning below the list: whether disconnecting the last
  // provider would leave the person with no way in. The server refuses that
  // case regardless (CustomSocialAccountAdapter.validate_disconnect) — this
  // just says so before the tap instead of after.
  const { data: profile } = useQuery<Profile>({
    queryKey: PASSWORD_PROFILE_QUERY_KEY,
    queryFn: fetchMyProfile,
    staleTime: 0,
  });

  const accounts = data ?? [];
  const hasPassword = profile?.has_usable_password !== false;
  const isLastWayIn = accounts.length === 1 && !hasPassword;

  const extractApiError = useCallback<ErrorExtractor>(
    (err) => {
      const payload = err.response?.data;
      const message = payload
        ? payload?.detail ||
          payload?.non_field_errors?.[0] ||
          Object.values(payload).flat().join("\n")
        : null;

      return {
        title: t("linked_accounts_action_failed"),
        message: message || t("could_not_update_linked_accounts"),
      };
    },
    [t],
  );

  const run = async (action: () => Promise<unknown>, tag: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({
        queryKey: SOCIAL_ACCOUNTS_QUERY_KEY,
      });
      return true;
    } catch (e) {
      const err = e as AppError;
      const isConnectivityError = err.isNetworkError || err.isTimeout;
      showErrorToast(e, tag, isConnectivityError ? undefined : extractApiError);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async (provider: SocialProvider) => {
    let connected = false;

    const ok = await run(async () => {
      connected =
        provider === "google" ? await connectGoogle() : await connectApple();
    }, `connect_${provider}`);

    // `connected === false` is the person backing out of the provider's own
    // dialog — nothing failed and nothing changed, so there is nothing to say.
    if (ok && connected) {
      Toast.show({
        type: "success",
        text1: t("linked_account_connected", {
          provider: providerLabel(provider),
        }),
      });
    }
  };

  const handleDisconnect = (item: SocialAccountItem) =>
    BottomSheet.show({
      title: t("linked_account_disconnect_title"),
      description: t("linked_account_disconnect_message", {
        provider: providerLabel(item.provider),
      }),
      confirmText: t("linked_account_disconnect_button"),
      cancelText: t("cancel"),
      danger: true,
      onConfirm: async () => {
        const ok = await run(
          () => disconnectSocialAccount(item.id),
          "disconnectSocialAccount",
        );
        if (ok) {
          Toast.show({
            type: "success",
            text1: t("linked_account_disconnected", {
              provider: providerLabel(item.provider),
            }),
          });
        }
      },
    });

  const connectedProviders = new Set(accounts.map((item) => item.provider));

  const connectButtons: { provider: SocialProvider; icon: IconType }[] = [
    ...(connectedProviders.has("google")
      ? []
      : [{ provider: "google" as const, icon: "logo-google" as IconType }]),
    ...(appleAvailable && !connectedProviders.has("apple")
      ? [{ provider: "apple" as const, icon: "logo-apple" as IconType }]
      : []),
  ];

  if (isLoading) return <LoadingOverlay />;

  if (isError && !data) {
    return (
      <ErrorOverlay
        title={t("linked_accounts_title")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );
  }

  return (
    <Layout
      withScroll
      onRefresh={refetch}
      isRefreshing={isRefetching}
      style={{ paddingHorizontal: 16, paddingTop: 16 }}
    >
      <Text style={styles.hint}>{t("linked_accounts_hint")}</Text>

      {accounts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            name="link-outline"
            size={40}
            color={Colors.textSecondary}
          />
          <Text style={styles.emptyText}>{t("linked_accounts_empty")}</Text>
        </View>
      ) : (
        accounts.map((item) => (
          <View key={item.id} style={styles.row} testID={`social-${item.id}`}>
            <Ionicons
              name={PROVIDER_ICON[item.provider] ?? "link-outline"}
              size={20}
              color={Colors.textMain}
            />
            <View style={styles.rowText}>
              <Text style={styles.provider}>
                {providerLabel(item.provider)}
              </Text>
              {item.email ? (
                <Text style={styles.email} numberOfLines={1}>
                  {item.email}
                </Text>
              ) : null}
            </View>
            <Pressable
              style={styles.disconnect}
              onPress={() => handleDisconnect(item)}
              disabled={busy}
              testID={`social-disconnect-${item.id}`}
            >
              <Text style={[styles.disconnectText, { color: Colors.error600 }]}>
                {t("linked_account_disconnect_button")}
              </Text>
            </Pressable>
          </View>
        ))
      )}

      {isLastWayIn && (
        <Text style={styles.warning}>{t("linked_accounts_last_way_in")}</Text>
      )}

      {connectButtons.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t("linked_accounts_add")}</Text>
          {connectButtons.map(({ provider, icon }) => (
            <Pressable
              key={provider}
              style={styles.connectButton}
              onPress={() => handleConnect(provider)}
              disabled={busy}
              testID={`social-connect-${provider}`}
            >
              <Ionicons name={icon} size={20} color={Colors.textMain} />
              <Text style={styles.connectText}>
                {t("linked_account_connect", {
                  provider: providerLabel(provider),
                })}
              </Text>
            </Pressable>
          ))}
        </>
      )}
    </Layout>
  );
};

export default LinkedAccountsScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    hint: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
    },
    provider: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
    },
    email: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    disconnect: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    disconnectText: {
      fontSize: 14,
      fontWeight: "600",
    },
    warning: {
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 18,
      marginTop: 12,
    },
    empty: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 32,
    },
    emptyText: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center",
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      color: Colors.textSecondary,
      marginTop: 24,
      marginBottom: 8,
    },
    connectButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 14,
      marginBottom: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.border,
      backgroundColor: Colors.primary100,
    },
    connectText: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
    },
  });
