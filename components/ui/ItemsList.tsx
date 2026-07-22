import {
  FlatList,
  StyleSheet,
  ActivityIndicator,
  FlatListProps,
  ListRenderItem,
  RefreshControl,
} from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";
import EmptyState from "../Empty/EmptyState";
import { EmptyStateProps } from "../../types";

interface ItemsListProps<T> {
  data: T[];
  onEndReached?: () => void;
  isLoadingMore?: boolean;
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  emptyType?: "filtered" | string;
  onClear?: () => void;
  noItems?: EmptyStateProps;
  listHeader?: FlatListProps<T>["ListHeaderComponent"];
  // Pull to refresh. Lists are cached (some for a day) and revalidate on
  // their own schedule; this is the way to ask for fresh data right now.
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const ItemsList = <T,>({
  data,
  onEndReached,
  isLoadingMore,
  renderItem,
  keyExtractor,
  emptyType,
  onClear,
  noItems,
  listHeader,
  onRefresh,
  isRefreshing,
}: ItemsListProps<T>) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();

  const getEmptyProps = (): EmptyStateProps | null => {
    if (!emptyType) return null;

    if (emptyType === "filtered") {
      return {
        icon: "search-outline",
        message: t("nothing_found"),
        actions: [
          { label: t("reset_filters"), onPress: onClear ?? (() => {}) },
        ],
      };
    }

    return noItems ?? null;
  };

  const emptyProps = getEmptyProps();

  return (
    <>
      <FlatList
        testID="items-list"
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.list,
          data.length === 0 && { flexGrow: 1 },
        ]}
        onEndReached={() => {
          if (!isLoadingMore && data.length > 0) {
            onEndReached?.();
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          data.length === 0 && emptyProps ? (
            <EmptyState
              key="empty-state"
              {...(emptyProps as EmptyStateProps)}
            />
          ) : null
        }
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator
              key="footer-loader"
              size="small"
              color={Colors.textMain}
              style={{ marginVertical: 10 }}
            />
          ) : null
        }
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!isRefreshing}
              onRefresh={onRefresh}
              tintColor={Colors.textMain}
              colors={[Colors.textMain]}
            />
          ) : undefined
        }
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
      />
    </>
  );
};

export default ItemsList;

const styles = StyleSheet.create({
    list: { paddingHorizontal: 12, paddingVertical: 8 },
  });
