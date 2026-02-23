import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";

const DefaultOptionRow = ({
  item,
  selected,
  onSelect,
  onClose,
  itemHeight,
}) => {
  const { Colors } = useTheme();
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
        pressed && { backgroundColor: Colors.primary300 },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          {item.iconLabel && (
            <Ionicons
              name={item.iconLabel}
              size={16}
              color={Colors.accent}
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

        {isActive && (
          <Ionicons name="checkmark-circle-outline" size={32} color={Colors.accent} />
        )}
      </View>
    </Pressable>
  );
};

export default DefaultOptionRow;

const stylesFn = (Colors, itemHeight) => StyleSheet.create({
  item: {
    height: itemHeight,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: Colors.primary100,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
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

  labelActive: {
    fontWeight: "600",
  },

  icon: {
    fontSize: 18,
    marginRight: 6,
  },
});
