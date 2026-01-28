import {
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";
import PlaceCard from "./PlaceCard";
import EmptyState from "../Empty/EmptyState";

const Places = ({
  data,
  onEndReached,
  isLoadingMore,
  onAddPlace,
  emptyType,
  onClear,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();

  const renderPlace = ({ item }) => <PlaceCard item={item} />;

  const getEmptyProps = () => {
    if (!emptyType) return null;

    if (emptyType === "filtered") {
      return {
        icon: "search-outline",
        message: t("nothing_found"),
        actions: [{ label: t("reset_filters"), onPress: onClear }],
      };
    }

    return {
      icon: "location-outline",
      message: t("no_places_yet"),
      actions: [{ label: t("add_first_place"), onPress: onAddPlace }],
    };
  };

  const emptyProps = getEmptyProps();

  return (
    <>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPlace}
        contentContainerStyle={[
          styles.list,
          data.length === 0 && { flexGrow: 1 },
        ]}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={emptyProps ? <EmptyState {...emptyProps} /> : null}
        ListFooterComponent={
          isLoadingMore && (
            <ActivityIndicator
              size="small"
              color={Colors.textMain}
              style={{ marginVertical: 10 }}
            />
          )
        }
      />

      <Pressable style={styles.fab} onPress={onAddPlace}>
        <Ionicons name="add" size={28} color={Colors.buttonPrimaryText} />
      </Pressable>
    </>
  );
};

export default Places;

const stylesFn = (Colors) =>
  StyleSheet.create({
    list: { padding: 12 },
    fab: {
      position: "absolute",
      bottom: 20,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: Colors.buttonBg,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
  });
