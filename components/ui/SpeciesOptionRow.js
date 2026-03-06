import { StyleSheet, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";

import { Config } from "../../constants/config";
import { useTheme } from "../../store/theme-context";
import { BirdSVG } from "./Svgs";

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
        isActive && styles.itemActive,
        pressed && { backgroundColor: Colors.primary300 },
      ]}
    >
      <View style={styles.row}>
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
            {item.name_lang }
          </Text>

          {item.name_lang !== item.name && (
            <Text numberOfLines={1} style={[styles.latin, isActive && styles.labelActive]}>
              {item.name}
            </Text>
          )}
        </View>
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
      borderBottomColor: Colors.border,
      borderLeftWidth: 4,
      borderLeftColor: "transparent",
    },

    itemPressed: {
      backgroundColor: Colors.primary200,
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
      borderLeftColor: Colors.mainTextDate,
      backgroundColor: Colors.primary200, 
    },
    labelActive: {
      fontWeight: "600",
      color: Colors.primary500,
    },
  });
