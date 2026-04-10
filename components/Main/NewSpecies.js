import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";

const H_PAD = 16;

const NewSpecies = ({ data }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.groupLabel}>
          {t("new_species") ?? "Новые виды"}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate("Stat")}>
          <Text style={styles.seeAll}>{t("all") ?? "все"} →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nsList}>
        {data.map((sp, i) => (
          <TouchableOpacity
            key={sp.key}
            style={[styles.nsRow, i < data.length - 1 && styles.nsRowDivider]}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate("SpeciesDetail", { species: sp })
            }
          >
            <View style={styles.nsImgBox}>
              <Text style={{ fontSize: 24 }}>{sp.emoji}</Text>
            </View>
            <View style={styles.nsNames}>
              <Text style={styles.nsCommon}>{sp.name}</Text>
              <Text style={styles.nsLatin}>{sp.latin}</Text>
            </View>
            <Text style={styles.nsDate}>{sp.date}</Text>
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
    },
    groupLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      marginLeft: H_PAD,
      marginBottom: 8,
      marginTop: 4,
    },

    seeAll: {
      fontSize: 14,
      fontWeight: "500",
      marginRight: H_PAD,
      color: Colors.main100,
    },

    nsList: {
      marginBottom: 4,
    },
    nsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
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
