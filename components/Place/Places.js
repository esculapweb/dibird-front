import {
  FlatList,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";
import MetaItem from "../ui/MetaItem";
import { isoToFlagEmoji } from "../../util/fetches";

const Places = ({ data, onEndReached, isLoadingMore }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const renderPlace = ({ item, index }) => {
    const territoryText = item.territory_data
      ? `${isoToFlagEmoji(item.territory_data.code)} ${item.territory_data.name}`
      : "";

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
      >
        <View style={styles.row}>
          {/* Здесь можно вставить картинку, если есть */}
          <View style={styles.imagePlaceholder} />

          <View style={styles.content}>
            <Text style={styles.title}>
              {index + 1}. {item.name}
            </Text>

            <View style={styles.latinRow}>
              <Text style={styles.latin}>{territoryText}</Text>
            </View>

            <View style={styles.meta}>
              <View style={styles.metaLeft}>
                <MetaItem icon="book-outline" text={item.diary_count} />
                <MetaItem icon="eye-outline" text={item.observation_count} />
                <MetaItem icon="leaf-outline" text={item.species_count} />
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderPlace}
      contentContainerStyle={styles.list}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isLoadingMore ? (
          <ActivityIndicator
            size="small"
            color={Colors.textMain}
            style={{ marginVertical: 8 }}
          />
        ) : null
      }
    />
  );
};

export default Places;

const stylesFn = (Colors) =>
  StyleSheet.create({
    list: {
      padding: 8,
    },
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 6,
      marginBottom: 6,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    pressedCard: {
      opacity: 0.9,
    },
    row: {
      flexDirection: "row",
    },
    imagePlaceholder: {
      width: 56,
      height: 56,
      borderRadius: 12,
      marginRight: 8,
      backgroundColor: Colors.imageBg,
    },
    content: {
      flex: 1,
      justifyContent: "flex-start",
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      lineHeight: 20,
    },
    latinRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 1,
    },
    latin: {
      fontSize: 12,
      fontStyle: "italic",
      color: Colors.statIcon,
    },
    meta: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginTop: 3,
    },
    metaLeft: {
      flexDirection: "row",
    },
  });
