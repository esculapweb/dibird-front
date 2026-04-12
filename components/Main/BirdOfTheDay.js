import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../store/theme-context";

const H_PAD = 16;

const BirdOfTheDay = ({ filters }) => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const data = {
    emoji: "🦅",
    name: "Орлан-белохвост",
    latin: "Haliaeetus albicilla",
    hintKey: "bird_of_day_hint",
  };

  return (
    <TouchableOpacity
      style={styles.botdCard}
      activeOpacity={0.85}
      onPress={() => navigation.navigate("BirdOfDay")}
    >
      <View style={styles.botdStrip}>
        <View style={styles.botdStripLeft}>
          <Ionicons name="star" size={16} color={Colors.main100} />
          <Text style={styles.botdStripTitle}>
            {t("bird_of_day") ?? "Птица дня"}
          </Text>
        </View>
        <Text style={styles.botdStripSub}>
          {t("find_today") ?? "Найди сегодня"}
        </Text>
      </View>

      <View style={styles.botdBody}>
        <View style={styles.botdImgBox}>
          <Text style={{ fontSize: 30 }}>{data.emoji}</Text>
        </View>
        <View style={styles.botdText}>
          <Text style={styles.botdName}>{data.name}</Text>
          <Text style={styles.botdLatin}>{data.latin}</Text>
          <Text style={styles.botdHint}>
            {t(data.hintKey) ?? "Рядом · нет в чеклисте"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={22} color={Colors.border} />
      </View>
    </TouchableOpacity>
  );
};

export default BirdOfTheDay;

const stylesFn = (Colors) =>
  StyleSheet.create({
    botdCard: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      backgroundColor: Colors.primary100,
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
      backgroundColor: Colors.primary200,
    },
    botdStripLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    botdStripTitle: {
      fontSize: 15,
      fontWeight: "600",
      // FIX: textMain instead of main100 — higher contrast on primary200 bg
      color: Colors.textMain,
    },
    botdStripSub: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    botdBody: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    botdImgBox: {
      width: 58,
      height: 58,
      borderRadius: 14,
      backgroundColor: Colors.backgroundMain,
      borderWidth: 0.5,
      borderColor: Colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
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
  });
