import { useCallback, useLayoutEffect } from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import ItemsList from "../components/ui/ItemsList";
import NotificationCard from "../components/Notification/NotificationCard";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import Layout from "../components/ui/Layout";
import { fetchNotifications, markNotificationsRead } from "../util/fetches";
import { AppNotification } from "../types";
import { UNREAD_COUNT_KEY } from "../hooks/useUnreadCount";
import { AppStackNavigationProp } from "../types";
import { useTheme, ThemeColors } from "../store/theme-context";

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<AppStackNavigationProp>();
  const queryClient = useQueryClient();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["notifications"],
      queryFn: ({ pageParam = 1 }) => fetchNotifications(pageParam),
      getNextPageParam: (last, pages) =>
        last.pagination.next ? pages.length + 1 : undefined,
      initialPageParam: 1,
    });

  // Пометить все прочитанными и обновить счётчик
  const handleMarkAllRead = useCallback(async () => {
    await markNotificationsRead();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
  }, [queryClient]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: t("notifications"),
      headerRight: () => (
        <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAll}>
          <Text style={styles.markAllText}>{t("mark_all_read")}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleMarkAllRead, Colors]);

  // Навигация при тапе на уведомление
  const handlePress = useCallback(
    async (item: AppNotification) => {
      // Пометить одно прочитанным
      if (!item.is_read) {
        await markNotificationsRead([item.id]);
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
      }

      // Навигация по data.screen
      const { screen, obsId, speciesId, achievementId } = item.data;
      switch (screen) {
        case "Community":
          navigation.navigate("Community", { highlightObsId: obsId });
          break;
        case "SpeciesDetail":
          if (speciesId)
            navigation.navigate("SpeciesDetail", { id: speciesId });
          break;
        case "Achievements":
          navigation.navigate("Achievements", { highlightId: achievementId });
          break;
        //   case 'Checklists':
        //     navigation.navigate('Checklists')
        //     break
        default:
          break;
      }
    },
    [navigation, queryClient],
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
        emptyType={items.length === 0 ? "initial" : undefined}
        noItems={{
          icon: "notifications-outline",
          message: t("no_notifications"),
        }}
      />
    </Layout>
  );
}

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    markAll: { paddingHorizontal: 16, paddingVertical: 8 },
    markAllText: { fontSize: 14, color: Colors.main100 },
  });
