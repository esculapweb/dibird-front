import { useCallback, useLayoutEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import * as Updates from "expo-updates";
import Toast from "react-native-toast-message";

import ItemsList from "../components/ui/ItemsList";
import NotificationCard from "../components/Notification/NotificationCard";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import Layout from "../components/ui/Layout";
import IconsHeader from "../components/ui/IconsHeader";
import { overflowButton } from "../components/ui/overflowMenu";
import { fetchNotifications, markNotificationsRead } from "../util/fetches";
import {
  AppNotification,
  getAppUpdateStage,
  isNotificationPayload,
} from "../types";
import { routeNotification } from "../util/notificationRoute";
import { UNREAD_COUNT_KEY } from "../hooks/useUnreadCount";
import { AppStackNavigationProp } from "../types";

// Screens whose unsaved form state a reload would silently drop.
const EDITOR_SCREENS = ["ObservationEditor", "DiaryEditor", "PlaceEditor"];

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam = 1 }) => fetchNotifications(pageParam),
    getNextPageParam: (last, pages) =>
      last.pagination.next ? pages.length + 1 : undefined,
    initialPageParam: 1,
  });

  const handleMarkAllRead = useCallback(async () => {
    await markNotificationsRead();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
  }, [queryClient]);

  // In the menu rather than as a header button of its own: the label is long
  // in Russian and used to crowd the title, and this is a rare, sweeping
  // action — exactly what "⋯" is for on every other screen.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t("notifications"),
      headerRight: () => (
        <IconsHeader
          headerRightEnd={[
            overflowButton([
              {
                label: t("mark_all_read"),
                icon: "checkmark-done-outline",
                testID: "mark-all-read-button",
                onPress: () => {
                  void handleMarkAllRead();
                },
              },
            ]),
          ]}
        />
      ),
    });
  }, [navigation, handleMarkAllRead, t]);

  const handlePress = useCallback(
    async (item: AppNotification) => {
      if (!item.is_read) {
        await markNotificationsRead([item.id]);
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      }

      // "Update ready" applies the update instead of navigating — that tap is
      // the whole point of the notification (hooks/useAppUpdateNotifications).
      if (getAppUpdateStage(item.data) === "pending") {
        // A reload throws away whatever an editor further down the stack is
        // holding: form state lives in memory, not in the offline mirror. The
        // update is already downloaded and applies itself on the next cold
        // start anyway, so losing a half-written observation to it would be a
        // poor trade.
        const editorOpen = navigation
          .getState()
          ?.routes.some((route) => EDITOR_SCREENS.includes(route.name));

        if (editorOpen) {
          Toast.show({
            type: "info",
            text1: t("update_ready"),
            text2: t("update_finish_editing_first"),
          });
          return;
        }

        await Updates.reloadAsync();
        return;
      }

      // The same payload that arrives as a push, routed by the same switch —
      // this screen used to hold a copy of it, and the copies drifted (see
      // util/notificationRoute).
      if (!isNotificationPayload(item.data)) return;
      // `navigate` is a set of per-screen overloads and rejects a screen that is
      // still generic at the call site. Widening it loses nothing: the
      // screen/params pairing is already checked inside routeNotification, and
      // against this very stack (see NotificationNavigate).
      const navigate = navigation.navigate as (
        screen: string,
        params?: object,
      ) => void;
      routeNotification(item.data, (screen, params) => navigate(screen, params));
    },
    [navigation, queryClient, t],
  );

  const items = data?.pages.flatMap((p) => p.results) ?? [];

  const renderItem = ({ item }: { item: AppNotification }) => (
    <NotificationCard item={item} onPress={handlePress} />
  );

  if (isLoading) return <LoadingOverlay />;

  return (
    <Layout>
      <ItemsList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `notif-${item.id}`}
        onEndReached={() => hasNextPage && fetchNextPage()}
        isLoadingMore={isFetchingNextPage}
        onRefresh={refetch}
        isRefreshing={isRefetching}
        emptyType={items.length === 0 ? "initial" : undefined}
        noItems={{
          icon: "notifications-outline",
          message: t("no_notifications"),
        }}
      />
    </Layout>
  );
}


