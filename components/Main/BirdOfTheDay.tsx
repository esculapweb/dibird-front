import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";

import { fetchBirdOfDay } from "../../util/fetches";
import { BirdSVG } from "../ui/Svgs";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { Config } from "../../constants/config";
import BirdOfTheDaySkeleton from "./BirdOfTheDaySceleton";
import { useProfile } from "../../store/profile-context";
import { useLanguage } from "../../store/language-context";
import { BottomSheet } from "../../services/bottomSheet";
import { speciesDetails } from "../../util/helpers";
import { AppStackNavigationProp, BirdOfTheDayType, Filters } from "../../types";

const H_PAD = 16;
const IMAGE_SIZE = 64;

const getHintKey = (data: BirdOfTheDayType): string => {
  return data?.reason?.hint_key ?? "hint_seasonal";
};

const BirdOfTheDay = ({ filters }: { filters: Filters }) => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { language } = useLanguage();
  const { profile } = useProfile();
  const territory = filters?.territory ?? profile?.territory ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["BirdOfDay", territory, language],
    queryFn: () => fetchBirdOfDay(territory),
    enabled: !!filters && !!territory,
  });

  if (isLoading) return <BirdOfTheDaySkeleton />;
  if (!data) return null;

  const isAlreadySeen = [
    "seen_60d_outside",
    "seen_in_window",
    "seen_recently",
  ].includes(data.reason?.user_seen_state);
  const hintKey = getHintKey(data);

  const handleShowBottomSheetMenu = () => {
    BottomSheet.showMenu({
      items: [
        {
          label: t("add_observation"),
          icon: "add-circle-outline" as const,
          onPress: () => {
            navigation.navigate("ObservationEditor", {
              defaultTerritory: filters?.territory ?? null,
              defaultPlace: filters?.place ?? null,
              defaultSpecies: data?.taxon_id,
              returnMode: "back",
            });
            BottomSheet.hide();
          },
        },
        {
          label: t("species_details"),
          icon: "information-circle-outline" as const,
          onPress: () => {
            speciesDetails(data.sp_segment);
            BottomSheet.hide();
          },
        },
      ],
    });
  };

  return (
    <TouchableOpacity
      style={styles.botdCard}
      activeOpacity={0.85}
      onPress={handleShowBottomSheetMenu}
    >
      <View style={styles.botdStrip}>
        <View style={styles.botdStripLeft}>
          <Ionicons name="telescope" size={16} color={Colors.textOpposite} />
          <Text style={styles.botdStripTitle}>{t("bird_of_day")}</Text>
        </View>
        <View style={{ flexDirection: "row" }}>
          <Text style={styles.botdStripSub}>
            {isAlreadySeen ? t(data.reason.user_seen_state) : t("find_today")}
          </Text>
          {data?.reason.user_seen_state === "seen_recently" && (
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={Colors.textOpposite}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </View>

      <View style={styles.botdBody}>
        <View style={styles.imageWrapper}>
          {data.sp_thumb ? (
            <Image
              source={{ uri: `${Config.mediaUrl}/${data.sp_thumb}` }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <BirdSVG size={26} color={Colors.textSecondary} />
            </View>
          )}
        </View>
        <View style={styles.botdText}>
          <Text style={styles.botdName} numberOfLines={2}>
            {data.sp_name_lang}
          </Text>
          <Text style={styles.botdLatin} numberOfLines={1}>
            {data.sp_latin}
          </Text>
          <Text style={styles.botdHint}>{t(hintKey)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={Colors.border} />
      </View>
    </TouchableOpacity>
  );
};

export default BirdOfTheDay;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    botdCard: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      overflow: "hidden",
    },
    botdStrip: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: Colors.main100,
    },
    botdStripLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    botdStripTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textOpposite,
    },
    botdStripSub: {
      fontSize: 13,
      color: Colors.textOpposite,
    },
    botdBody: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: Colors.primary100,
    },
    botdText: { flex: 1 },
    botdName: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
    },
    botdLatin: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontStyle: "italic",
      marginTop: 3,
    },
    botdHint: {
      fontSize: 13,
      marginTop: 5,
      color: Colors.main100,
    },
    imageWrapper: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
    },
    image: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },
    imagePlaceholder: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
      justifyContent: "center",
      alignItems: "center",
    },
  });

// t("hint_never_seen")
// t("hint_seen_long_ago")
// t("hint_seen_recently")
// t("hint_endemic")
// t("hint_threatened")
// t("hint_seasonal")

// t("never_seen")
// t("seen_outside_window")
// t("seen_60d_outside")
// t("seen_in_window")
// t("seen_recently")
