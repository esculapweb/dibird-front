import { useCallback } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "../../store/theme-context";
import { fetchStat } from "../../util/fetches";
import { useList } from "../../hooks/useList";

const H_PAD = 16;

const NewSpecies = ({ filters, filtersLoaded }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const fetchStatSeen = useCallback((filters, sort, search, page) => {
    return fetchStat({ ...filters, seen: true }, sort, search, page);
  }, []);

  const { data: newSpeciesData, isLoading } = useList({
    screenName: "Stat",
    fetchFunction: fetchStatSeen,
    filters,
    tabsMode: "seen",
    sort: "-seen,-date_time",
    enabled: filtersLoaded,
  });

  const data = newSpeciesData?.pages?.[0]?.results?.slice(0, 3) ?? [];

  // const data = [
  //   {
  //     key: "sp1",
  //     emoji: "🦢",
  //     name: "Лебедь-кликун",
  //     latin: "Cygnus cygnus",
  //     date: "8 апр",
  //   },
  //   {
  //     key: "sp2",
  //     emoji: "🐦",
  //     name: "Авдотка",
  //     latin: "Burhinus oedicnemus",
  //     date: "7 апр",
  //   },
  //   {
  //     key: "sp3",
  //     emoji: "🕊️",
  //     name: "Белокрылая крачка",
  //     latin: "Chlidonias leucopterus",
  //     date: "4 апр",
  //   },
  // ];

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
          {t("new_species") ?? "Новые виды"}
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
        >
          <Text style={styles.seeAll}>{t("all") ?? "все"} →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nsList}>
        {data.map((item, i) => (
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
            <View style={styles.nsImgBox}>
              <Text style={{ fontSize: 24 }}>{item.ioc_id}</Text>
            </View>
            <View style={styles.nsNames}>
              <Text style={styles.nsCommon}>{item.sp_name_lang}</Text>
              <Text style={styles.nsLatin}>{item.sp_latin}</Text>
            </View>
            <Text style={styles.nsDate}>{item.min_date}</Text>
          </TouchableOpacity>
        ))}
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
      marginLeft: H_PAD + 8,
      marginBottom: 8,
    },
    seeAll: {
      fontSize: 14,
      fontWeight: "500",
      marginRight: H_PAD + 8,
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
      paddingVertical: 13,
      backgroundColor: Colors.primary100,
    },
    nsRowDivider: {
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.divider,
    },
    nsImgBox: {
      width: 48,
      height: 48,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      backgroundColor: Colors.backgroundMain,
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
    },
  });
