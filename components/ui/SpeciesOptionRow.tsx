import { StyleSheet, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { Config } from "../../constants/config";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { BirdSVG } from "./Svgs";
import { SpeciesDropdownItem } from "../../types";


interface SpeciesOptionRow {
  item: SpeciesDropdownItem,
  selected: string | number | null,
  onSelect: (value: string | number | null)=>void,
  onClose: ()=>void,
  itemHeight?: number;
  disabled?: boolean;
  index?: number;
  // Multi-select mode of SelectListModal: a tap checks the row instead of
  // picking it, and the list stays open.
  multiple?: boolean;
  checked?: boolean;
  onToggle?: (value: string | number) => void;
}

const SpeciesOptionRow = ({
  item,
  selected,
  onSelect,
  onClose,
  itemHeight = 52,
  disabled = false,
  index,
  multiple = false,
  checked = false,
  onToggle,
}: SpeciesOptionRow) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors, itemHeight);
  const isActive = multiple ? checked : item.value === selected;

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        if (multiple) {
          onToggle?.(item.value);
          return;
        }
        onSelect(item.value);
        onClose();
      }}
      testID={index != null ? `option-row-${index}` : undefined}
      style={({ pressed }) => [
        styles.item,
        isActive && styles.itemActive,
        disabled && styles.itemDisabled,
        pressed && styles.itemPressed,
      ]}
    >
      <View style={[styles.row, disabled && { opacity: 0.4 }]}>
        <View style={styles.imageWrapper}>
          {item.thumb ? (
            <Image
              source={{ uri: `${Config.mediaUrl}/${item.thumb}` }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <BirdSVG size={22} color={Colors.textSecondary} />
            </View>
          )}
        </View>

        <View style={styles.textBlock}>
          <Text
            numberOfLines={1}
            style={[styles.name, isActive && styles.nameActive]}
          >
            {item.name_lang}
          </Text>

          {item.name_lang !== item.name && (
            <Text
              numberOfLines={1}
              style={[styles.latin, isActive && styles.labelActive]}
            >
              {item.name} {item.seen}
            </Text>
          )}
        </View>

        {item.seen && (
          <Ionicons
            name="eye-outline"
            size={18}
            color={Colors.green}
            style={styles.eyeIcon}
          />
        )}

        {multiple && !disabled && (
          <Ionicons
            name={checked ? "checkbox" : "square-outline"}
            size={28}
            color={checked ? Colors.main100 : Colors.textSecondary}
            style={styles.checkIcon}
            testID={index != null ? `option-row-check-${index}` : undefined}
          />
        )}
      </View>
    </Pressable>
  );
};

export default SpeciesOptionRow;

const stylesFn = (Colors: ThemeColors, itemHeight: number) =>
  StyleSheet.create({
    item: {
      height: itemHeight,
      justifyContent: "center",
      paddingHorizontal: 12,
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

    imageWrapper: {
      width: 44,
      height: 44,
      marginRight: 12,
    },

    image: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },

    imagePlaceholder: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
      justifyContent: "center",
      alignItems: "center",
    },

    textBlock: {
      flex: 1,
      justifyContent: "center",
    },

    name: {
      fontSize: 16,
      color: Colors.textMain,
      lineHeight: 20,
    },

    nameActive: {
      fontWeight: "600",
    },

    latin: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontStyle: "italic",
      marginTop: 2,
    },

    itemActive: {
      borderLeftColor: Colors.main100,
      backgroundColor: Colors.main300,
    },
    labelActive: {
      fontWeight: "600",
      color: Colors.main100,
    },
    itemDisabled: {
      borderLeftColor: "transparent",
    },

    checkIcon: {
      marginLeft: 8,
    },

    eyeIcon: {
      marginLeft: 8,
      marginRight: 2,
    },
  });
