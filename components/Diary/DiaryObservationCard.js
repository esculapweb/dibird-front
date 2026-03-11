import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import { BirdSVG } from "../ui/Svgs";
import { formatDateLong, isoToFlagEmoji } from "../../util/helpers";
import { Config } from "../../constants/config";
import { useTheme } from "../../store/theme-context";
import { formatTimeString } from "../../util/timeHelpers";

const useStyles = (Colors) => React.useMemo(() => stylesFn(Colors), [Colors]);

const DiaryObservationCard = React.memo(({ item, index }) => {
  const { Colors } = useTheme();
  const styles = useStyles(Colors);
  const navigation = useNavigation();

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
              uri: `${Config.mediaUrl}/${item.species_data.thumb}`,
            }}
            style={styles.image}
            contentFit="cover"
            transition={0}
            cachePolicy="disk"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <BirdSVG size={38} color={Colors.textSecondary} />
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <View style={styles.indexBadge}>
                <Text style={styles.index}>{index + 1}.</Text>
              </View>
              <Text style={styles.title} numberOfLines={1}>
                {item.species_data?.name_lang}
              </Text>
            </View>
            {item.notes && (
              <Ionicons
                name="document-text-outline"
                size={13}
                color={Colors.textSecondary}
              />
            )}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.latin} numberOfLines={1}>
              {item.species_data?.name}
            </Text>

            <View style={styles.metaRight}>
              {item.quantity && (
                <View style={styles.badge}>
                  <BirdSVG size={14} color={Colors.textMain} />
                  <Text style={styles.badgeText}>{item.quantity}</Text>
                </View>
              )}
              {item.time && (
                <View style={styles.time}>
                  <Ionicons
                    name="time-outline"
                    size={13}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.metaText}>
                    {formatTimeString(item.time)}
                  </Text>
                </View>
              )}

              
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

export default DiaryObservationCard;

const stylesFn = (Colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 8,
      marginBottom: 4,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
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
      width: 40,
      height: 40,
      borderRadius: 12,
      marginRight: 8,
      backgroundColor: Colors.imageBg,
    },

    imagePlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 12,
      marginRight: 8,
      backgroundColor: Colors.imageBg,
      justifyContent: "center",
      alignItems: "center",
    },

    content: {
      flex: 1,
    },

    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    titleLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
    },
    index: {
      fontSize: 12,
      color: Colors.textSecondary,
      flexShrink: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      flex: 1,
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

    metaRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
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
      color: Colors.textSecondary,
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
