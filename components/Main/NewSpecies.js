import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import { useTheme } from "../../store/theme-context";

import { Config } from "../../constants/config";
import { BirdSVG } from "../ui/Svgs";
import { formatDateShort } from "../../util/helpers";

const H_PAD = 16;
const IMAGE_SIZE = 48;

const NewSpecies = ({ filters, newSpeciesData, isLoading }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);


  const isYearFilter =
    filters?.date?.type === "year" || filters?.date?.type === "this_year";

  const data = newSpeciesData?.pages?.[0]?.results?.slice(0, 3) ?? [];

  if (isLoading) {
    return (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.groupLabel}>{t("new_species")}</Text>
        </View>
        <View style={styles.nsList}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.nsRow, i < 2 && styles.nsRowDivider]}>
              <View
                style={[
                  styles.nsImgBox,
                  { opacity: 0.2, backgroundColor: Colors.textMain },
                ]}
              />
              <View style={[styles.nsNames, { gap: 6 }]}>
                <View
                  style={{
                    height: 15,
                    width: "60%",
                    borderRadius: 4,
                    backgroundColor: Colors.textMain,
                    opacity: 0.2,
                  }}
                />
                <View
                  style={{
                    height: 13,
                    width: "40%",
                    borderRadius: 4,
                    backgroundColor: Colors.textMain,
                    opacity: 0.1,
                  }}
                />
              </View>
              <View
                style={{
                  height: 13,
                  width: 40,
                  borderRadius: 4,
                  backgroundColor: Colors.textMain,
                  opacity: 0.2,
                }}
              />
            </View>
          ))}
        </View>
      </>
    );
  }

  if (data.length === 0) return null;

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.groupLabel}>
          {t("new_species")}
        </Text>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("Stat", {
              filtersOverride: {
                ...filters,
              },
              seenMode: "seen",
              o: "-seen,-date_time",
            })
          }
          hitSlop={8}
        >
          <Text style={styles.seeAll}>{t("all")} →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nsList}>
        {data.map((item, i) => {
          const { d, y } = formatDateShort(item.min_date);
          return (
            <TouchableOpacity
              key={item.species_id}
              style={[styles.nsRow, i < data.length - 1 && styles.nsRowDivider]}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate("Observations", {
                  filtersOverride: {
                    territory: filters.territory ?? null,
                    place: filters.place ?? null,
                    species: item.species_id,
                    speciesName: item.sp_name_lang,
                    date: filters.date ?? null,
                  },
                })
              }
            >
              <View style={styles.imageWrapper}>
                {item.sp_thumb ? (
                  <Image
                    source={{ uri: `${Config.mediaUrl}/${item.sp_thumb}` }}
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
              <View style={styles.nsNames}>
                <Text style={styles.nsCommon} numberOfLines={2}>{item.sp_name_lang}</Text>
                <Text style={styles.nsLatin} numberOfLines={1}>{item.sp_latin}</Text>
              </View>
              <Text style={styles.nsDate}>
                {d}
                {!isYearFilter && <Text>{`\n${y}`}</Text>}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
};

export default NewSpecies;

const stylesFn = (Colors) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
      marginBottom: 0,
    },
    groupLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      marginLeft: H_PAD,
      marginBottom: 8,
    },
    seeAll: {
      fontSize: 14,
      fontWeight: "500",
      marginRight: H_PAD,
      color: Colors.main100,
    },
    nsList: {
      marginHorizontal: H_PAD,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 12,
    },
    nsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: Colors.primary100,
    },
    nsRowDivider: {
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.divider,
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
    nsNames: { flex: 1 },
    nsCommon: {
      fontSize: 15,
      fontWeight: "500",
      color: Colors.textMain,
    },
    nsLatin: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontStyle: "italic",
      marginTop: 2,
    },
    nsDate: {
      fontSize: 13,
      color: Colors.textSecondary,
      flexShrink: 0,
      textAlign: "right",
    },
  });
