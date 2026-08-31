import { memo } from "react";
import { View, StyleSheet } from "react-native";
import IconButton from "./IconButton";
import { useTheme } from "../../store/theme-context";
import { IconButtonConfig } from "../../types";

interface IconsHeaderProps {
  hasActiveFilters?: boolean;
  onSortPress?: () => void;
  onFilterPress?: () => void;
  headerRightBeginning?: IconButtonConfig[];
  headerRightEnd?: IconButtonConfig[];
}

/**
 * The icons of a screen header, always in this order: whatever the screen puts
 * first, then sorting, then filters, then whatever it puts last — which is
 * where the "⋯" button belongs (see components/ui/overflowMenu).
 *
 * There is deliberately no share button here any more. Icons carry no labels,
 * so only actions with an unmistakable pictogram earn one — editing, saving,
 * sorting, filtering — and everything else (sharing, deleting, reporting,
 * blocking, comparing) lives in the overflow menu, where it has a name.
 */
const IconsHeader = ({
  hasActiveFilters,
  onSortPress,
  onFilterPress,
  headerRightBeginning = [],
  headerRightEnd = [],
}: IconsHeaderProps) => {
  const { Colors } = useTheme();

  const iconButtons: IconButtonConfig[] = [
    ...(Array.isArray(headerRightBeginning) ? headerRightBeginning : []),
    // testID on both: these are the only header buttons without text (sorting
    // and filters are Ionicons icons), and in Maestro there is nothing else to
    // grab onto but coordinates. Set here rather than at the call sites: the
    // buttons are the same on every screen with a list — see
    // .maestro/list-sort-persist.yaml and .maestro/taxonomy-tree-filters.yaml.
    {
      condition: !!onSortPress,
      onPress: onSortPress,
      icon: "swap-vertical",
      testID: "sort-button",
    },
    {
      condition: !!onFilterPress,
      onPress: onFilterPress,
      icon: hasActiveFilters ? "options" : "options-outline",
      active: hasActiveFilters,
      testID: "filter-button",
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
