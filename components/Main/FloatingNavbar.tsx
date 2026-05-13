import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { formatDateFilterMain } from "../../util/helpers";
import {
  AppDrawerNavigationProp,
  Filters,
  TerritoryDropdownItem,
} from "../../types";

const H_PAD = 16;

const FloatingNavbar = ({
  onPress,
  filters,
  country,
}: {
  onPress: () => void;
  filters: Filters;
  country?: TerritoryDropdownItem;
}) => {
  const navigation = useNavigation<AppDrawerNavigationProp>();
  const { Colors, isDark } = useTheme();

  const insets = useSafeAreaInsets();
  const NAVBAR_HEIGHT = insets.top + 60;
  const styles = stylesFn(Colors, NAVBAR_HEIGHT);

  const countryFlag = country?.icon ?? "   ";

  return (
    <View style={styles.navbarAbsolute}>
      <LinearGradient
        colors={
          isDark
            ? ["rgba(18,18,18,0.95)", "rgba(18,18,18,0.4)", "rgba(18,18,18,0)"]
            : [
                "rgba(247,246,242,0.95)",
                "rgba(247,246,242,0.4)",
                "rgba(247,246,242,0)",
              ]
        }
        locations={[0, 0.4, 0.85]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.navbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.openDrawer()}
          hitSlop={8}
          style={styles.burgerWrapper}
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

        <View style={{ width: 22 }} />
      </View>
    </View>
  );
};

export default FloatingNavbar;

const stylesFn = (Colors: ThemeColors, NAVBAR_HEIGHT: number) =>
  StyleSheet.create({
    navbarAbsolute: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      height: NAVBAR_HEIGHT + 20,
    },
    navbar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: H_PAD,
      paddingBottom: 14,
    },
    burgerWrapper: {
      gap: 5,
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
  });
