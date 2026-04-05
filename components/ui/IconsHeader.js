import { memo } from "react";
import { View, StyleSheet } from "react-native";
import IconButton from "./IconButton";
import { useTheme } from "../../store/theme-context";

const IconsHeader = ({
  hasActiveFilters,
  onSortPress,
  onFilterPress,
  onSharePress,
  headerRightBeginning = [],
  headerRightEnd = [],
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn();

  const iconButtons = [
    ...(Array.isArray(headerRightBeginning) ? headerRightBeginning : []),
    {
      condition: !!onSortPress,
      onPress: onSortPress,
      icon: "swap-vertical",
    },
    {
      condition: !!onFilterPress,
      onPress: onFilterPress,
      icon: hasActiveFilters ? "options" : "options-outline",
      active: hasActiveFilters,
    },
    {
      condition: !!onSharePress,
      onPress: onSharePress,
      icon: "share-social-outline",
    },
    ...(Array.isArray(headerRightEnd) ? headerRightEnd : []),
  ];

  return (
    <View style={styles.headerButtons}>
      {iconButtons
        .filter((btn) => btn.condition)
        .map((btn, index) => (
          <IconButton
            key={index}
            tintColor={btn?.tintColor ?? Colors.textMain}
            onPress={btn.onPress}
            icon={btn.icon}
            style={styles.iconButton}
            size={btn.size ?? 24}
            disabled={btn?.disabled}
            loading={btn?.loading}
            active={btn?.active}
          />
        ))}
    </View>
  );
};

export default memo(IconsHeader);

const stylesFn = () =>
  StyleSheet.create({
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 3,
    },
    iconButton: {
      marginRight: 0,
    },
  });
