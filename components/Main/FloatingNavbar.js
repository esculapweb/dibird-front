import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";
import { formatDateFilterMain } from "../../util/helpers";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { fetchMyCountries } from "../../util/fetches";
import { useLanguage } from "../../store/language-context";

const H_PAD = 16;

const FloatingNavbar = ({ showDivider, onPress, filters }) => {
  const navigation = useNavigation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors, showDivider);
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();

  const { query: countriesQuery } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
    enabled: !!filters?.territory,
  });

  const countryFlag =
    countriesQuery.data?.filter(
      (item) => item.value === filters?.territory,
    )?.[0]?.icon ?? "   ";

  return (
    <View style={styles.navbarAbsolute}>
      <View style={[styles.navbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.openDrawer()}
          hitSlop={8}
          style={{ gap: 5 }}
        >
          <View style={styles.burgerLine} />
          <View style={styles.burgerLine} />
          <View style={styles.burgerLine} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.pill} onPress={onPress}>
          <Text style={styles.pillFlag}>
            {filters?.territory ? (
              countryFlag
            ) : (
              <Ionicons name="globe-outline" size={18} color={Colors.main100} />
            )}
          </Text>
          <Text style={styles.pillText} numberOfLines={1}>
            {formatDateFilterMain(filters?.date)}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={Colors.textSecondary}
          />
        </TouchableOpacity>

        <View style={{ width: 8 }} />
      </View>
      <View style={[styles.divider, { opacity: showDivider ? 1 : 0 }]} />
    </View>
  );
};

export default FloatingNavbar;

const stylesFn = (Colors, showDivider) =>
  StyleSheet.create({
    navbarAbsolute: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      ...(showDivider && {
        backgroundColor: Colors.backgroundMain,
      }),
    },
    navbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: H_PAD,
      paddingBottom: 14,
    },
    burgerLine: {
      width: 22,
      height: 2,
      borderRadius: 1,
      backgroundColor: Colors.textMain,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: Colors.primary100,
      borderWidth: 0.5,
      borderColor: Colors.border,
      borderRadius: 20,
      paddingVertical: 9,
      paddingLeft: 12,
      paddingRight: 14,
      maxWidth: 300,
    },
    pillFlag: { fontSize: 17 },
    pillText: {
      fontSize: 15,
      fontWeight: "500",
      color: Colors.textMain,
      flexShrink: 1,
    },
    divider: { height: 0.5, backgroundColor: Colors.divider },
  });
