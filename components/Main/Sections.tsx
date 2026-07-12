import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import {
  AppStackNavigationProp,
  DashboardStat,
  IconType,
} from "../../types";
import { useContentWidth } from "../../hooks/useContentWidth";

const H_PAD = 16;
const SEC_GAP = 8;
const SEC_COLS = 3;

type SectionKey =
  | "Observations"
  | "Places"
  | "Stat"
  | "Diaries"
  | "Rating"
  | "Checklist";

interface Section {
  key: SectionKey;
  icon: IconType;
  labelKey: string;
  showBadge?: boolean;
}

const Sections = ({ data }: { data: DashboardStat }) => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const { t } = useTranslation();
  const width = useContentWidth();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const SEC_W = (width - H_PAD * 2 - SEC_GAP * (SEC_COLS - 1)) / SEC_COLS;

  const SECTIONS: Section[] = [
    { key: "Observations", icon: "binoculars", labelKey: "observations" },
    { key: "Places", icon: "location", labelKey: "places" },
    { key: "Stat", icon: "stats-chart", labelKey: "statistics" },
    { key: "Diaries", icon: "book", labelKey: "diaries", showBadge: false },
    { key: "Rating", icon: "trophy", labelKey: "rating" },
    { key: "Checklist", icon: "checkbox", labelKey: "checklist" },
  ];

  return (
    <>
      <View style={styles.secGrid}>
        {Array.from({ length: Math.ceil(SECTIONS.length / SEC_COLS) }).map(
          (_, rowIndex) => {
            const row = SECTIONS.slice(
              rowIndex * SEC_COLS,
              rowIndex * SEC_COLS + SEC_COLS,
            );

            return (
              <View key={rowIndex} style={styles.secRow}>
                {row.map((sec) => (
                  <TouchableOpacity
                    key={sec.key}
                    style={[
                      styles.secCard,
                      { backgroundColor: Colors.primary100, width: SEC_W },
                    ]}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate(sec.key)}
                  >
                    {sec.showBadge && data.diaries > 0 && (
                      <View
                        style={[
                          styles.secBadge,
                          { backgroundColor: Colors.main100 },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: Colors.textOpposite,
                          }}
                        >
                          {data.diaries}
                        </Text>
                      </View>
                    )}

                    <Ionicons
                      name={sec.icon}
                      size={30}
                      color={Colors.main100}
                      style={{ marginBottom: 10 }}
                    />

                    <Text
                      style={[styles.secLabel, { color: Colors.textSecondary }]}
                    >
                      {t(sec.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}

                {row.length < SEC_COLS &&
                  Array.from({ length: SEC_COLS - row.length }).map((_, i) => (
                    <View key={`empty-${i}`} style={{ width: SEC_W }} />
                  ))}
              </View>
            );
          },
        )}
      </View>
    </>
  );
};

export default Sections;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    groupLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      marginLeft: H_PAD,
      marginVertical: 8,
    },
    secGrid: {
      paddingHorizontal: H_PAD,
    },
    secRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: SEC_GAP,
      width: "100%",
    },
    secCard: {
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: Colors.border,
      paddingVertical: 22,
      paddingHorizontal: 8,
      alignItems: "center",
      position: "relative",
    },
    secLabel: {
      fontSize: 13,
      textAlign: "center",
      color: Colors.textSecondary,
    },
    secBadge: {
      position: "absolute",
      top: 8,
      right: 9,
      borderRadius: 9,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    secBadgeText: { fontSize: 11, fontWeight: "600" },
  });
