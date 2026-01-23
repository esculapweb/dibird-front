import {
  FlatList,
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatDate, isoToFlagEmoji } from "../../util/fetches";
import { Config } from "../../constants/config";
import { Colors } from "../../constants/styles";

const MetaItem = ({ icon, text }) => {
  if (!text) return null;

  return (
    <View style={styles.metaItem}>
      {icon && <Ionicons name={icon} size={11} color={Colors.statIcon} />}
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
};

const Stats = ({ data, seen = false }) => {
  const renderItem = ({ item, index }) => {
    const minDate = item?.min_date && formatDate(item.min_date);
    const maxDate = item?.max_date && formatDate(item.max_date);

    const dateText =
      minDate && maxDate && minDate !== maxDate
        ? `${minDate} – ${maxDate}`
        : minDate || maxDate;

    const countriesText = item?.min_territory
      ? `${isoToFlagEmoji(item.min_territory)}${
          item?.max_territory && item.max_territory !== item.min_territory
            ? isoToFlagEmoji(item.max_territory)
            : ""
        }${item?.qty_countries > 2 ? ` +${item.qty_countries - 2}` : ""}`
      : null;

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
      >
        <View style={styles.row}>
          {item.sp_thumb ? (
            <Image
              source={{ uri: `${Config.baseUrl}/media/${item.sp_thumb}` }}
              style={[
                styles.image,
                !seen && styles.imageSmall,
              ]}
            />
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                !seen && styles.imageSmall,
              ]}
            />
          )}

          <View style={styles.content}>
            <Text style={styles.title}>
              {index + 1}. {item.sp_name_lang}
            </Text>

            <View style={styles.latinRow}>
              <Text style={styles.latin}>{item.sp_latin}</Text>
              {seen && countriesText && (
                <Text style={styles.flags}>{countriesText}</Text>
              )}
            </View>

            {seen && (
              <View style={styles.meta}>
                <View style={styles.metaLeft}>
                  <MetaItem icon="calendar-outline" text={dateText} />
                </View>

                <View style={styles.metaRight}>
                  <View style={styles.observations}>
                    <Ionicons name="eye-outline" size={11} color={Colors.textMain} />
                    <Text style={styles.observationsText}>
                      {item.qty_observations}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
    />
  );
};

export default Stats;

const styles = StyleSheet.create({
  list: {
    padding: 8,
  },

  card: {
    backgroundColor: Colors.primary100,
    borderRadius: 12,
    padding: 6,
    marginBottom: 6,
    shadowColor: Colors.textMain,
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

  image: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: Colors.imageBg,
  },

  imagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: Colors.imageBg,
  },

  imageSmall: {
    width: 40,
    height: 40,
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

  flags: {
    fontSize: 13,
  },

  meta: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 3,
  },

  metaLeft: {
    flex: 1,
  },

  metaRight: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
    marginTop: 1,
  },

  metaText: {
    marginLeft: 2,
    fontSize: 11,
    color: Colors.textMain,
  },

  observations: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.backgroundMain,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 1,
  },

  observationsText: {
    marginLeft: 2,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMain,
  },
});
