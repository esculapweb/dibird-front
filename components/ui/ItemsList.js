import {
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";
import EmptyState from "../Empty/EmptyState";

const ItemsList = ({
  data,
  screen,
  onEndReached,
  isLoadingMore,
  onAdd,
  emptyType,
  onClear,
  ItemCard,
  noItems
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();

  const renderItem = ({ item, index }) => <ItemCard item={item} index={index} />;

  const getEmptyProps = () => {
    if (!emptyType) return null;

    if (emptyType === "filtered") {
      return {
        icon: "search-outline",
        message: t("nothing_found"),
        actions: [{ label: t("reset_filters"), onPress: onClear }],
      };
    }

    return noItems;
  };

  const emptyProps = getEmptyProps();

  return (
    <>
      <FlatList
        data={data}
        keyExtractor={(item, index) => {
          if (item?.id) {
            return `${screen}-${item.id}`;
          }
          return `${screen}-${index}-${Date.now()}`;
        }}
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
        ListEmptyComponent={
          data.length === 0 && emptyProps ? (
            <EmptyState key="empty-state" {...emptyProps} />
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
      />

      <Pressable style={styles.fab} onPress={onAdd}>
        <Ionicons name="add" size={28} color={Colors.buttonBrightColor} />
      </Pressable>
    </>
  );
};

export default ItemsList;

const stylesFn = (Colors) =>
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
      backgroundColor: Colors.buttonBrightBg,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
  });
