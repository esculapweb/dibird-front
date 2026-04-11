import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";

const DefaultOptionRow = ({
  item,
  selected,
  onSelect,
  onClose,
  itemHeight,
}) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors, itemHeight);
  const isActive = item.value === selected;

  return (
    <Pressable
      onPress={() => {
        onSelect(item.value);
        onClose();
      }}
      style={({ pressed }) => [
        styles.item,
        isActive && styles.itemActive,
        pressed && styles.itemPressed,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.left}>
           {item.iconLabel && (
            <Ionicons
              name={item.iconLabel}
              size={16}
              color={Colors.yellow}
              style={styles.icon}
            />
          )}
          {item.icon && <Text style={styles.icon}>{item.icon}</Text>}
        </View>

        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          style={[styles.label, isActive && styles.labelActive]}
        >
          {item.label}
        </Text>

        {item.iconLabelRight && (
          <Ionicons
            name={item.iconLabelRight}
            size={16}
            color={Colors.yellow}
            style={styles.iconLabelRight}
          />
        )}

        {item.distance != null && (
          <Text style={styles.distance}>
            {item.distance >= 1000
              ? `~${(item.distance / 1000).toFixed(1)} ${t("km")}`
              : `~${item.distance} ${t("m")}`}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

export default DefaultOptionRow;

const stylesFn = (Colors, itemHeight) =>
  StyleSheet.create({
    item: {
      minHeight: itemHeight,
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 4,
      backgroundColor: Colors.primary100,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.border,
      borderLeftWidth: 4,
      borderLeftColor: "transparent",
    },

    itemPressed: {
      backgroundColor: Colors.main300,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
    },
    label: {
      flex: 1,
      fontSize: 16,
      lineHeight: 20,
      color: Colors.textMain,
      paddingRight: 6,
    },

    icon: {
      fontSize: 18,
      marginRight: 6,
    },
    distance: {
      fontSize: 12,
      color: Colors.main100,
      marginRight: 8,
    },
    itemActive: {
      borderLeftColor: Colors.main100,
      backgroundColor: Colors.main300,
    },
    labelActive: {
      fontWeight: "600",
      color: Colors.main100,
    },
    iconLabelRight: {
      marginLeft: 8,
      marginRight: 2,
    },
  });
