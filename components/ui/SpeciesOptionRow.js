import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { Config } from "../../constants/config";
import { useTheme } from "../../store/theme-context";

const SpeciesOptionRow = ({
  item,
  selected,
  onSelect,
  onClose,
  itemHeight = 52,
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
        <View style={styles.imageWrapper}>
          {item.thumb ? (
            <Image
              source={{ uri: `${Config.baseUrl}/media/${item.thumb}` }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons
                name="image-outline"
                size={20}
                color={Colors.dropdownIcon}
              />
            </View>
          )}
        </View>

        <View style={styles.textBlock}>
          <Text
            numberOfLines={1}
            style={[styles.name, isActive && styles.nameActive]}
          >
            {item.labelLang}
          </Text>

          {item.labelLang !== item.labelLatin && (
            <Text numberOfLines={1} style={styles.latin}>
              {item.labelLatin}
            </Text>
          )}
        </View>

        {isActive && (
          <Ionicons name="checkmark-circle" size={32} color={Colors.accent} />
        )}
      </View>
    </Pressable>
  );
};

export default SpeciesOptionRow;

const stylesFn = (Colors, itemHeight) =>
  StyleSheet.create({
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

    imageWrapper: {
      width: 44,
      height: 44,
      marginRight: 12,
    },

    image: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: Colors.card,
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
      color: Colors.text,
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
  });
