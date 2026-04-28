import { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import { BirdSVG } from "../ui/Svgs";
import { formatDateLong, isoToFlagEmoji } from "../../util/helpers";
import { Config } from "../../constants/config";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { AppStackNavigationProp, DiaryListItem } from "../../types";

const useStyles = (Colors: ThemeColors) => useMemo(() => stylesFn(Colors), [Colors]);

const DiaryCard = ({ item, index }: {item: DiaryListItem; index: number}) => {
  const { Colors } = useTheme();
  const styles = useStyles(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();

  const territoryFlag = item.territory_data
    ? isoToFlagEmoji(item.territory_data.code)
    : null;

  const dateText = formatDateLong(item.date_time);

  const handlePress = () => {
    navigation.navigate("DiaryDetail", { diaryId: item.id });
  };


  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressedCard]}
      onPress={handlePress}
    >
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.index}>{index + 1}.</Text>
            <Text style={styles.date}>{dateText}</Text>
          </View>
          <View style={styles.rightTop}>
            {item.private && (
              <Ionicons
                name="lock-closed-outline"
                size={13}
                color={Colors.textSecondary}
              />
            )}
            {territoryFlag && <Text style={styles.flag}>{territoryFlag}</Text>}
          </View>
        </View>

        {item.observation_data?.length > 0 && (
          <View style={styles.speciesRow}>
            {item.observation_data.map((obs, i) =>
              obs.species_data.thumb ? (
                <Image
                  key={i}
                  source={{ uri: `${Config.mediaUrl}/${obs.species_data.thumb}` }}
                  style={styles.speciesThumb}
                  contentFit="cover"
                />
              ) : (
                <View key={i} style={styles.speciesThumbPlaceholder}>
                  <BirdSVG size={26} color={Colors.textSecondary} />
                </View>
              ),
            )}
            {item.observation_count > 5 && (
              <View style={styles.moreCountBadge}>
                <Text style={styles.moreCount}>
                  +{item.observation_count - 5}
                </Text>
              </View>
            )}
          </View>
        )}

        {item?.place_data?.name && (
          <View style={styles.infoRow}>
            <Ionicons
              name="location-outline"
              size={13}
              color={Colors.textSecondary}
            />
            <Text style={styles.place} numberOfLines={1} ellipsizeMode="tail">
              {item.place_data.name}
            </Text>
          </View>
        )}

        {!!item.name && (
          <View style={styles.infoRow}>
            <Ionicons
              name="document-text-outline"
              size={13}
              color={Colors.textSecondary}
            />

            <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
              {item.name}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

export default DiaryCard;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      padding: 10,
      marginBottom: 4,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    pressedCard: { opacity: 0.85 },
    main: { gap: 8 },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
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
    },
    date: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      flexShrink: 1,
    },
    rightTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginLeft: 6,
    },
    flag: {
      fontSize: 18,
    },

    speciesRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    speciesThumb: {
      width: 48,
      height: 48,
      borderRadius: 10,
    },
    speciesThumbPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: Colors.imageBg,
      justifyContent: "center",
      alignItems: "center",
    },
    moreCountBadge: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: Colors.imageBg,
      justifyContent: "center",
      alignItems: "center",
    },
    moreCount: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textSecondary,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    place: {
      flexShrink: 1,
      fontSize: 12,
      color: Colors.textSecondary,
    },
    name: {
      flexShrink: 1,
      fontSize: 12,
      color: Colors.textSecondary,
      fontStyle: "italic",
    },
  });
