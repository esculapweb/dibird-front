import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../store/theme-context";

const H_PAD = 16;

const ChecklistHero = ({ data }) => {
  const navigation = useNavigation();
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
        <View style={styles.clNumRow}>
          <Text style={styles.clNum}>{data.seen}</Text>
          <Text style={styles.clOf}>
            {" "}{t("of") ?? "из"} {data.total}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={Colors.textOpposite}
          style={{ opacity: 0.8 }}
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
            { width: `${Math.round(clProgress * 100)}%` },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
};

export default ChecklistHero;

const stylesFn = (Colors) => {
  const muted =
    Colors.textOpposite === "#ffffff"
      ? "rgba(255,255,255,0.8)"
      : "rgba(31,41,55,0.8)";

  return StyleSheet.create({
    clCard: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      backgroundColor: Colors.main100,
      borderRadius: 14,
      padding: 18,
    },
    clTag: {
      fontSize: 14,
      marginBottom: 8,
      color: muted,
    },
    clRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
    },
    clNumRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
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
      color: muted,
    },
    clSub: {
      fontSize: 14,
      marginTop: 5,
      color: muted,
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
};
