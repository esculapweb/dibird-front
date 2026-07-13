import { memo } from "react";
import { View, StyleSheet } from "react-native";
import IconButton from "./IconButton";
import { useTheme } from "../../store/theme-context";
import { IconButtonConfig } from "../../types";

interface IconsHeaderProps {
  hasActiveFilters?: boolean;
  onSortPress?: () => void;
  onFilterPress?: () => void;
  onSharePress?: () => void;
  headerRightBeginning?: IconButtonConfig[];
  headerRightEnd?: IconButtonConfig[];
}

const IconsHeader = ({
  hasActiveFilters,
  onSortPress,
  onFilterPress,
  onSharePress,
  headerRightBeginning = [],
  headerRightEnd = [],
}: IconsHeaderProps) => {
  const { Colors } = useTheme();

  const iconButtons: IconButtonConfig[] = [
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

  const visibleButtons = iconButtons.filter((btn) => btn.condition);

  return (
    <View style={styles.container}>
      {visibleButtons.map((btn, index) => (
        <IconButton
          key={index}
          tintColor={btn?.tintColor ?? Colors.textMain}
          onPress={btn.onPress}
          icon={btn.icon}
          size={btn.size ?? 24}
          disabled={btn?.disabled}
          loading={btn?.loading}
          active={btn?.active}
          testID={btn?.testID}
        />
      ))}
    </View>
  );
};

export default memo(IconsHeader);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
});
