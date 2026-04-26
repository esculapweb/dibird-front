import { memo } from "react";
import { StyleSheet } from "react-native";
import IconButton from "./IconButton";
import { useTheme, ThemeColors } from "../../store/theme-context";

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
    <>
      {iconButtons
        .filter((btn) => btn.condition)
        .map((btn, index, arr) => (
          <IconButton
            key={index}
            tintColor={btn?.tintColor ?? Colors.textMain}
            onPress={btn.onPress}
            icon={btn.icon}
            size={btn.size ?? 24}
            disabled={btn?.disabled}
            loading={btn?.loading}
            active={btn?.active}
            style={[
              styles.iconButton,
              index < arr.length - 1 && { marginRight: 8 },
            ]}
          />
        ))}
    </>
  );
};

export default memo(IconsHeader);

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
    },
    iconButton: {
      marginRight: 0,
    },
  });
