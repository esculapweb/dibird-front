import React from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { formatDate, isoToFlagEmoji } from "../../util/fetches";
import { Config } from "../../constants/config";
import { useTheme } from "../../store/theme-context";

const useStyles = (Colors) => React.useMemo(() => stylesFn(Colors), [Colors]);

const ObservationCard = React.memo(({ item }) => {
  const { Colors } = useTheme();
  const styles = useStyles(Colors);
  const navigation = useNavigation();

  const dateText = formatDate(item.date_time);
  const territoryFlag = item.territory_data
    ? isoToFlagEmoji(item.territory_data.code)
    : null;

  const handlePress = () => {
    navigation.navigate("ObservationDetail", { observationId: item.id });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
      onPress={handlePress}
    >
      <View style={styles.row}>
        {item.species_data?.thumb ? (
          <Image
            source={{
              uri: `${Config.baseUrl}/media/${item.species_data.thumb}`,
            }}
            style={styles.image}
          />
        ) : (
          <View style={styles.imagePlaceholder} />
        )}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.species_data?.name_lang}
            </Text>

            <View style={styles.rightTop}>
              {item.private && (
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color={Colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
              )}
              {territoryFlag && (
                <Text style={styles.flag}>{territoryFlag}</Text>
              )}
            </View>
          </View>

          {/* LATIN */}
          <Text style={styles.latin} numberOfLines={1}>
            {item.species_data?.name}
          </Text>

          {/* META ROW */}
          <View style={styles.metaRow}>
            <View style={styles.metaLeft}>
              <Ionicons
                name="calendar-outline"
                size={13}
                color={Colors.textSecondary}
              />
              <Text style={styles.metaText}>{dateText}</Text>

              {item.time && (
                <View style={styles.time}>
                  <Ionicons
                    name="time-outline"
                    size={13}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.metaText}>{item.time}</Text>
                </View>
              )}
            </View>

            {item.quantity && (
              <View style={styles.badge}>
                <Ionicons
                  name="logo-twitter"
                  size={12}
                  color={Colors.textSecondary}
                />
                <Text style={styles.badgeText}>{item.quantity}</Text>
              </View>
            )}
          </View>

          {/* PLACE */}
          <View style={styles.placeRow}>
            {item.place ? (
              <>
                <Ionicons
                  name="location-outline"
                  size={13}
                  color={Colors.textSecondary}
                />
                <Text style={styles.placeText} numberOfLines={1}>
                  {item.place_data?.name}
                </Text>
              </>
            ) : <Text style={{flex:1}}></Text>}

            {item.notes && (
              <Ionicons
                name="information-circle-outline"
                size={13}
                color={Colors.textSecondary}
              />
            )}

            {item.diary && (
              <Ionicons
                name="book-outline"
                size={13}
                color={Colors.textSecondary}
              />
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

export default ObservationCard;

const stylesFn = (Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 8,
      marginBottom: 4,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },

    pressedCard: {
      opacity: 0.85,
    },

    row: {
      flexDirection: "row",
    },

    image: {
      width: 72,
      height: 72,
      borderRadius: 36,
      marginRight: 8,
      backgroundColor: Colors.imageBg,
    },

    imagePlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 36,
      marginRight: 8,
      backgroundColor: Colors.imageBg,
    },

    content: {
      flex: 1,
    },

    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },

    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      flex: 1,
      marginRight: 6,
    },

    rightTop: {
      flexDirection: "row",
      alignItems: "center",
    },

    flag: {
      fontSize: 14,
    },

    latin: {
      fontSize: 12,
      fontStyle: "italic",
      color: Colors.statIcon,
      marginTop: 1,
    },

    metaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 4,
    },

    time: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      marginLeft: 4,
    },

    metaLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },

    metaText: {
      fontSize: 12,
      color: Colors.textSecondary,
    },

    badge: {
      flexDirection: "row",
      alignItems: "center",
    },

    badgeText: {
      fontSize: 11,
      fontWeight: "600",
      marginLeft: 3,
      color: Colors.textMain,
    },

    placeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 3,
    },

    placeText: {
      fontSize: 12,
      color: Colors.textSecondary,
      flex: 1,
    },
  });
