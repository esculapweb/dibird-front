import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { formatDateFilterMain } from "../../util/helpers";
import FloatingHeader from "../ui/FloatingHeader";
import { useUnreadCount } from "../../hooks/useUnreadCount";
import {
  Filters,
  TerritoryDropdownItem,
  AppStackNavigationProp,
} from "../../types";

const FloatingNavbar = ({
  onPress,
  filters,
  country,
}: {
  onPress: () => void;
  filters: Filters;
  country?: TerritoryDropdownItem;
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const navigation = useNavigation<AppStackNavigationProp>();
  const { data: unreadCount = 0 } = useUnreadCount();

  const countryFlag = country?.icon ?? "   ";

  return (
    <FloatingHeader>
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
        <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.bell}
        onPress={() => navigation.navigate("Notifications")}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="notifications-outline"
          size={22}
          color={Colors.textMain}
        />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </FloatingHeader>
  );
};

export default FloatingNavbar;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
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
    bell: { position: "relative", width: 36, alignItems: "center" },
    badge: {
      position: "absolute",
      top: -4,
      right: -2,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: Colors.logoAccent,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: Colors.backgroundMain,
    },
    badgeText: { fontSize: 9, fontWeight: "700", color: Colors.markerBorder },
  });
