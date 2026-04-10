import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "../../store/theme-context";

const H_PAD = 16;

const QuickActions = () => {
    const navigation = useNavigation();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <>
      {/* <Text style={styles.groupLabel}>
        {t("quick_actions") ?? "Быстрые действия"}
      </Text> */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.qbtn, { backgroundColor: Colors.main100 }]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("DiaryEditor")}
        >
          <Ionicons name="book" size={22} color={Colors.textOpposite} />
          <Text style={[styles.qbtnText, { color: Colors.textOpposite }]}>
            + {t("diary") ?? "Дневник"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.qbtn,
            {
              backgroundColor: Colors.primary100,
              borderWidth: 0.5,
              borderColor: Colors.border,
            },
          ]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("ObservationEditor")}
        >
          <Ionicons name="binoculars" size={22} color={Colors.textMain} />
          <Text style={[styles.qbtnText, { color: Colors.textMain }]}>
            + {t("observation") ?? "Наблюдение"}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

export default QuickActions;

const stylesFn = (Colors) =>
  StyleSheet.create({
    groupLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      marginLeft: H_PAD,
      marginVertical: 8,
    },
    quickRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: H_PAD,
      marginBottom: 12,
    },
    qbtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 16,
      paddingVertical: 16,
    },
    qbtnText: {
      fontSize: 15,
      fontWeight: "600",
    },
  });
