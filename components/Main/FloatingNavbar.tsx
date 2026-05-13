import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { formatDateFilterMain } from "../../util/helpers";
import { Filters, TerritoryDropdownItem } from "../../types";
import FloatingHeader from "../ui/FloatingHeader";

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

      <View style={{ width: 22 }} />
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
  });
