import { useMemo, memo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import ProfileAvatar from "../Profile/ProfileAvatar";
import { BirdSVG } from "../ui/Svgs";
import {
  formatDateLong,
  isoToFlagEmoji,
  normalizeDistance,
} from "../../util/helpers";
import { Config } from "../../constants/config";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { formatTimeString } from "../../util/timeHelpers";
import { AppStackNavigationProp, ObservationItem } from "../../types";

const useStyles = (Colors: ThemeColors) =>
  useMemo(() => stylesFn(Colors), [Colors]);

const CommunityCard = memo(
  ({ item, index, highlightObsIds }: { item: ObservationItem; index: number; highlightObsIds?: number[] }) => {
    const { Colors } = useTheme();
    const styles = useStyles(Colors);
    const navigation = useNavigation<AppStackNavigationProp>();

    const dateText = formatDateLong(item.date_time);
    const territoryFlag = item.territory_data
      ? isoToFlagEmoji(item.territory_data.code)
      : null;

    const handlePress = () => {
      navigation.navigate("CommunityDetail", { observationId: item.id });
    };

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.pressedCard, highlightObsIds?.includes(item.id) && styles.hightlighted]}
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
                <Text style={styles.index}>{index + 1}.</Text>
                <Text style={styles.title} numberOfLines={1}>
                  {item.species_data?.name_lang}
                </Text>
              </View>

              <View style={styles.rightTop}>
                {territoryFlag && (
                  <Text style={styles.flag}>{territoryFlag}</Text>
                )}
              </View>
            </View>

            <Text style={styles.latin} numberOfLines={1}>
              {item.species_data?.name}
            </Text>

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
                    <Text style={styles.metaText}>
                      {formatTimeString(item.time)}
                    </Text>
                  </View>
                )}
              </View>

              {item.quantity && (
                <View style={styles.badge}>
                  <BirdSVG size={14} color={Colors.textMain} />
                  <Text style={styles.badgeText}>{item.quantity}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.underRow}>
          <View style={styles.leftRow}>
            <ProfileAvatar
              username={item?.external_source ?? "dibird"}
              size={22}
            />
            <Text style={styles.sourceName}>{item?.external_source}</Text>
            <Text style={styles.sourceName}>·</Text>
            <Text style={styles.authorName}>{item?.external_username}</Text>
          </View>
          {item?.distance && (
            <View style={styles.rightRow}>
              <Text style={styles.distance}>
                {normalizeDistance(item.distance)}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  },
);

export default CommunityCard;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
      marginBottom: 4,
    },

    pressedCard: {
      opacity: 0.85,
    },

    leftRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 2,
    },

    rightRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 4,
      flex: 1,
    },

    row: {
      flexDirection: "row",
      padding: 8,
      marginBottom: 4,
    },
    underRow: {
      flexDirection: "row",
      borderTopWidth: 0.5,
      borderTopColor: Colors.border,
      padding: 8,
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

    sourceName: {
      fontSize: 14,
      color: Colors.textMain,
    },

    authorName: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
    },

    distance: {
      fontSize: 12,
      color: Colors.main100,
      marginRight: 8,
    },
    hightlighted: {
      backgroundColor: Colors.main300,
    }
  });
