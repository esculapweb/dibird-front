import {
  FlatList,
  View,
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
  // A grid instead of rows (the species photo layout). Each item gets an
  // equal-width cell, so renderItem only has to fill the width it is given.
  numColumns?: number;
}

// Space between grid cells, in both directions.
export const GRID_GAP = 6;

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
  numColumns = 1,
}: ItemsListProps<T>) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const isGrid = numColumns > 1;

  // Fixed-width cells rather than flex: 1 items, so a half-empty last row
  // keeps its tiles the size of every other row's instead of stretching them.
  const gridRenderItem: ListRenderItem<T> = (info) => (
    <View style={[styles.cell, { width: `${100 / numColumns}%` }]}>
      {renderItem(info)}
    </View>
  );

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
        // FlatList can't change numColumns on a mounted list (it throws), so
        // switching rows ↔ grid has to mount a fresh one.
        key={`columns-${numColumns}`}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={isGrid ? gridRenderItem : renderItem}
        numColumns={numColumns}
        // The cells' padding makes the gaps; pulling each row out by half a
        // gap keeps the outer tiles flush with the header above them.
        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
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
        // Without this a tap on a row while the header's search field has
        // focus is spent on dismissing the keyboard, so the first tap looks
        // like it did nothing (same as SelectListModal's list).
        keyboardShouldPersistTaps="handled"
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
    gridRow: { marginHorizontal: -GRID_GAP / 2 },
    cell: { padding: GRID_GAP / 2 },
  });
