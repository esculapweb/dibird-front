import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";

const H_PAD = 16;

const ChecklistHero = ({ data }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const clProgress = data.seen / data.total;

  return (
    <TouchableOpacity
      style={styles.clCard}
      activeOpacity={0.85}
      onPress={() => navigation.navigate("Checklist")}
    >
      <Text style={styles.clTag} numberOfLines={1}>
        {t("checklist") ?? "Чек-лист"} · {data.country} {data.year}
      </Text>
      <View style={styles.clRow}>
        <Text style={styles.clNum}>
          {data.seen}
          {"  "}
          <Text style={styles.clOf}>
            {t("of") ?? "из"} {data.total}
          </Text>
        </Text>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={Colors.textOpposite}
          style={{ opacity: 0.4 }}
        />
      </View>
      <Text style={styles.clSub}>
        +{data.newCount} {t("new_in") ?? "новых в"}{" "}
        {t(data.monthKey) ?? "апреле"}
      </Text>
      <View style={styles.clBarBg}>
        <View
          style={[
            styles.clBarFill,
            {
              width: `${Math.round(clProgress * 100)}%`,
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
};

export default ChecklistHero;

const stylesFn = (Colors) =>
  StyleSheet.create({
    clCard: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      borderRadius: 18,
      padding: 18,
      backgroundColor: Colors.main100,
    },
    clTag: {
      fontSize: 13,
      marginBottom: 8,
      color: Colors.textOpposite,
      opacity: 0.65,
    },
    clRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    clNum: {
      fontSize: 40,
      fontWeight: "700",
      lineHeight: 44,
      color: Colors.textOpposite,
    },
    clOf: {
      fontSize: 16,
      fontWeight: "400",
      color: Colors.textOpposite,
      opacity: 0.65,
    },
    clSub: {
      fontSize: 13,
      marginTop: 5,
      color: Colors.textOpposite,
      opacity: 0.65,
    },
    clBarBg: {
      marginTop: 14,
      height: 5,
      borderRadius: 3,
      overflow: "hidden",
      backgroundColor: Colors.mainProgressBg,
    },
    clBarFill: {
      height: "100%",
      borderRadius: 3,
      backgroundColor: Colors.textOpposite,
    },
  });
