import { useCallback } from "react";
import {
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../store/theme-context";
import PlaceCard from "./PlaceCard";

const Places = ({ data, onEndReached, isLoadingMore, onAddPlace }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const renderPlace = useCallback(({ item }) => <PlaceCard item={item} />, []);

  return (
    <>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPlace}
        contentContainerStyle={styles.list}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
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
    list: {
      padding: 12,
    },
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
