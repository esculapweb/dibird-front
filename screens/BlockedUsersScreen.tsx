import { View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import Layout from "../components/ui/Layout";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import ProfileAvatar from "../components/Profile/ProfileAvatar";
import { useProfileDisplay } from "../hooks/Profile/useProfileDisplay";
import { useModeration } from "../hooks/useModeration";
import { fetchBlockedUsers } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import { useTheme, ThemeColors } from "../store/theme-context";
import { BlockedUser } from "../types";

const BlockedUserRow = ({
  item,
  onUnblock,
  styles,
  colors,
}: {
  item: BlockedUser;
  onUnblock: () => void;
  styles: ReturnType<typeof stylesFn>;
  colors: ThemeColors;
}) => {
  const { t } = useTranslation();
  const { fullName } = useProfileDisplay({
    firstName: item.blocked_data.first_name,
    lastName: item.blocked_data.last_name,
    username: item.blocked_data.username,
  });

  return (
    <View style={styles.row}>
      <ProfileAvatar
        avatar={item.blocked_data.avatar}
        firstName={item.blocked_data.first_name}
        lastName={item.blocked_data.last_name}
        username={item.blocked_data.username}
        size={36}
      />
      <Text style={styles.name} numberOfLines={1}>
        {fullName}
      </Text>
      <Pressable
        style={styles.unblock}
        onPress={onUnblock}
        testID={`unblock-${item.blocked}`}
      >
        <Text style={[styles.unblockText, { color: colors.main100 }]}>
          {t("unblock")}
        </Text>
      </Pressable>
    </View>
  );
};

/**
 * The list of people this user blocked, and the only way back from a block.
 *
 * Not offline-first, unlike the rest of the app's lists: unblocking is a
 * write that has to reach the server to mean anything (the feed is filtered
 * by it server-side), so a cached copy of the list would only promise an
 * action that cannot happen.
 */
const BlockedUsersScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { unblock } = useModeration();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ["blockedUsers"],
    queryFn: fetchBlockedUsers,
    staleTime: StaleTime.TEN_MINUTES,
  });

  if (isLoading) return <LoadingOverlay />;

  if (isError && !data) {
    return (
      <ErrorOverlay
        title={t("blocked_users")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );
  }

  return (
    <Layout style={{ padding: 12 }}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => String(item.blocked)}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListHeaderComponent={
          <Text style={styles.hint}>{t("blocked_users_hint")}</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="people-outline"
              size={40}
              color={Colors.textSecondary}
            />
            <Text style={styles.emptyText}>{t("blocked_users_empty")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <BlockedUserRow
            item={item}
            onUnblock={() => unblock(item.blocked)}
            styles={styles}
            colors={Colors}
          />
        )}
      />
    </Layout>
  );
};

export default BlockedUsersScreen;

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
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
    },
    name: {
      flex: 1,
      fontSize: 15,
      color: Colors.textMain,
    },
    unblock: {
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    unblockText: {
      fontSize: 14,
      fontWeight: "600",
    },
    empty: {
      alignItems: "center",
      gap: 8,
      paddingTop: 48,
    },
    emptyText: {
      fontSize: 14,
      color: Colors.textSecondary,
      textAlign: "center",
    },
  });
