import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { AppStackNavigationProp, Filters } from "../../types";

const H_PAD = 16;

const QuickActions = ({ filters }: {filters: Filters}) => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <>
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.qbtn, { backgroundColor: Colors.main100 }]}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate("DiaryEditor", {
              // undefined, not null — see ObservationsScreen: it lets the
              // editor fall back to the last saved/profile country instead of
              // opening with an empty required field.
              defaultTerritory: filters.territory ?? undefined,
              returnMode: "back",
            })
          }
          testID="quick-action-diary"
        >
          <Ionicons name="book" size={22} color={Colors.textOpposite} />
          <Text style={[styles.qbtnText, { color: Colors.textOpposite }]}>
            + {t("diary")}
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
          onPress={() =>
            navigation.navigate("ObservationEditor", {
              defaultTerritory: filters.territory ?? undefined,
            })
          }
          testID="quick-action-observation"
        >
          <Ionicons name="binoculars" size={22} color={Colors.textMain} />
          <Text style={[styles.qbtnText, { color: Colors.textMain }]}>
            + {t("observation")}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

export default QuickActions;

const stylesFn = (Colors: ThemeColors) =>
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
      borderRadius: 14,
      paddingVertical: 16,
    },
    qbtnText: {
      fontSize: 15,
      fontWeight: "600",
    },
  });
