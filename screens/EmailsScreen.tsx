import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";

import Layout from "../components/ui/Layout";
import Input from "../components/ui/Input";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import AnimatedLoadingButton from "../components/ui/AnimatedLoadingButton";
import { useTheme, ThemeColors } from "../store/theme-context";
import { useApiError } from "../hooks/useApiError";
import { BottomSheet } from "../services/bottomSheet";
import {
  addMyEmail,
  deleteMyEmail,
  fetchMyEmails,
  resendMyEmailConfirmation,
  setMyPrimaryEmail,
} from "../util/fetches";
import { EMAILS_QUERY_KEY } from "../constants/accountQueryKeys";
import { AppError, EmailAddressItem, ErrorExtractor } from "../types";

const EmailRow = ({
  item,
  onPress,
  styles,
  colors,
}: {
  item: EmailAddressItem;
  onPress: () => void;
  styles: ReturnType<typeof stylesFn>;
  colors: ThemeColors;
}) => {
  const { t } = useTranslation();

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      testID={`email-row-${item.id}`}
    >
      <Ionicons
        name={item.verified ? "mail-open-outline" : "mail-unread-outline"}
        size={18}
        color={item.verified ? colors.main100 : colors.textSecondary}
      />
      <View style={styles.rowText}>
        <Text style={styles.email} numberOfLines={1}>
          {item.email}
        </Text>
        <View style={styles.badges}>
          {item.primary && (
            <Text style={[styles.badge, styles.badgePrimary]}>
              {t("email_badge_primary")}
            </Text>
          )}
          <Text
            style={[
              styles.badge,
              item.verified ? styles.badgeVerified : styles.badgeUnverified,
            ]}
          >
            {item.verified
              ? t("email_badge_verified")
              : t("email_badge_unverified")}
          </Text>
        </View>
      </View>
      <Ionicons
        name="ellipsis-horizontal"
        size={18}
        color={colors.textSecondary}
      />
    </Pressable>
  );
};

/**
 * The account's e-mail addresses — the same list the website shows at
 * /accounts/email/, with the same rules about what may be done to it.
 *
 * Online only, and deliberately so: every action here is a change to the
 * account that only the server can make, and a list served from a stale cache
 * would offer to remove addresses that are already gone.
 */
const EmailsScreen = () => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showErrorToast } = useApiError();

  const [newEmail, setNewEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: EMAILS_QUERY_KEY,
    queryFn: fetchMyEmails,
    staleTime: 0,
  });

  const emails = data ?? [];

  const extractApiError = useCallback<ErrorExtractor>(
    (err) => {
      const payload = err.response?.data;
      const message = payload
        ? payload?.detail ||
          payload?.email?.[0] ||
          Object.values(payload).flat().join("\n")
        : null;

      return {
        title: t("emails_action_failed"),
        message: message || t("could_not_update_emails"),
      };
    },
    [t],
  );

  const run = async (action: () => Promise<unknown>, tag: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
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

  const handleAdd = async () => {
    if (adding) return;

    const trimmed = newEmail.trim();

    if (!trimmed.includes("@")) {
      setInvalid(true);
      Toast.show({
        type: "error",
        text1: t("invalid_input"),
        text2: t("check_credentials"),
      });
      return;
    }

    setInvalid(false);
    setAdding(true);
    const ok = await run(() => addMyEmail(trimmed), "addMyEmail");
    setAdding(false);

    if (ok) {
      setNewEmail("");
      Toast.show({
        type: "success",
        text1: t("email_added"),
        text2: t("confirmation_sent_to", { email: trimmed }),
      });
    }
  };

  const handleSetPrimary = async (item: EmailAddressItem) => {
    const ok = await run(() => setMyPrimaryEmail(item.id), "setMyPrimaryEmail");
    if (ok) Toast.show({ type: "success", text1: t("email_primary_changed") });
  };

  const handleResend = async (item: EmailAddressItem) => {
    const ok = await run(
      () => resendMyEmailConfirmation(item.id),
      "resendMyEmailConfirmation",
    );
    if (ok) {
      Toast.show({
        type: "success",
        text1: t("confirmation_sent_to", { email: item.email }),
      });
    }
  };

  const handleRemove = (item: EmailAddressItem) =>
    BottomSheet.show({
      title: t("email_remove_title"),
      description: t("email_remove_message", { email: item.email }),
      confirmText: t("remove"),
      cancelText: t("cancel"),
      danger: true,
      onConfirm: async () => {
        const ok = await run(() => deleteMyEmail(item.id), "deleteMyEmail");
        if (ok) Toast.show({ type: "success", text1: t("email_removed") });
      },
    });

  const openMenu = (item: EmailAddressItem) => {
    // The rules the server enforces, mirrored here so that an action which
    // could only ever come back as a 400 is not offered at all: the primary
    // address cannot be removed, nor can the last one, and only a confirmed
    // address can become primary.
    const actions = [];

    if (item.verified && !item.primary) {
      actions.push({
        label: t("email_make_primary"),
        icon: "star-outline" as const,
        onPress: () => handleSetPrimary(item),
        testID: `email-make-primary-${item.id}`,
      });
    }

    if (!item.verified) {
      actions.push({
        label: t("email_resend_confirmation"),
        icon: "send-outline" as const,
        onPress: () => handleResend(item),
        testID: `email-resend-${item.id}`,
      });
    }

    if (!item.primary && emails.length > 1) {
      actions.push({
        label: t("remove"),
        icon: "trash-outline" as const,
        onPress: () => handleRemove(item),
        danger: true,
        testID: `email-remove-${item.id}`,
      });
    }

    if (actions.length === 0) {
      Toast.show({ type: "info", text1: t("email_no_actions") });
      return;
    }

    BottomSheet.showMenu({ title: item.email, items: actions });
  };

  if (isLoading) return <LoadingOverlay />;

  if (isError && !data) {
    return (
      <ErrorOverlay
        title={t("emails_title")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );
  }

  return (
    <Layout withKeyboard style={{ paddingHorizontal: 16, paddingTop: 16 }}>
      <FlatList
        data={emails}
        keyExtractor={(item) => String(item.id)}
        // The page scrolls, not the list: the add-an-address form sits below
        // it inside the same keyboard-aware scroll view. Pull-to-refresh would
        // be dead weight here for the same reason — a FlatList that does not
        // scroll never fires it — and the query refetches on focus anyway.
        scrollEnabled={false}
        ListHeaderComponent={
          <Text style={styles.hint}>{t("emails_hint")}</Text>
        }
        renderItem={({ item }) => (
          <EmailRow
            item={item}
            onPress={() => openMenu(item)}
            styles={styles}
            colors={Colors}
          />
        )}
      />

      <Text style={styles.sectionTitle}>{t("email_add_title")}</Text>
      <Input
        label={t("email_address")}
        onUpdateValue={setNewEmail}
        value={newEmail}
        keyboardType="email-address"
        isInvalid={invalid}
        textContentType="emailAddress"
        autoComplete="email"
        testID="add-email-input"
      />
      <View style={styles.buttonContainer}>
        <AnimatedLoadingButton
          onPress={handleAdd}
          loading={adding}
          testID="add-email-button"
        >
          {t("email_add_button")}
        </AnimatedLoadingButton>
      </View>
    </Layout>
  );
};

export default EmailsScreen;

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
      gap: 4,
    },
    email: {
      fontSize: 15,
      color: Colors.textMain,
    },
    badges: {
      flexDirection: "row",
      gap: 6,
    },
    badge: {
      fontSize: 11,
      fontWeight: "700",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      overflow: "hidden",
    },
    badgePrimary: {
      color: Colors.textOpposite,
      backgroundColor: Colors.main100,
    },
    badgeVerified: {
      color: Colors.main100,
      backgroundColor: Colors.main300,
    },
    badgeUnverified: {
      color: Colors.error600,
      backgroundColor: Colors.error100,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      color: Colors.textSecondary,
      marginTop: 24,
      marginBottom: 8,
    },
    buttonContainer: {
      marginVertical: 16,
      borderRadius: 16,
    },
  });
