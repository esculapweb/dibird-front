import {
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatListProps,
  ListRenderItem,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import EmptyState from "../Empty/EmptyState";
import { IconType, EmptyStateProps } from "../../types";

interface ItemsListProps<T> {
  data: T[];
  onEndReached?: () => void;
  isLoadingMore?: boolean;
  onAdd?: () => void;
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  emptyType?: "filtered" | string;
  onClear?: () => void;
  noItems?: EmptyStateProps;
  listHeader?: FlatListProps<T>["ListHeaderComponent"];
  fabIcon?: IconType;
}

const ItemsList = <T,>({
  data,
  onEndReached,
  isLoadingMore,
  onAdd,
  renderItem,
  keyExtractor,
  emptyType,
  onClear,
  noItems,
  listHeader,
  fabIcon = "add",
}: ItemsListProps<T>) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
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
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
      />

      {onAdd && (
        <Pressable style={styles.fab} onPress={onAdd}>
          <Ionicons name={fabIcon} size={28} color={Colors.textOpposite} />
        </Pressable>
      )}
    </>
  );
};

export default ItemsList;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    list: { paddingHorizontal: 12, paddingVertical: 8 },
    fab: {
      position: "absolute",
      bottom: 20,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.main100,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
  });
