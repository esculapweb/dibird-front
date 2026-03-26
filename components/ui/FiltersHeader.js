import { memo } from "react";
import { View, StyleSheet } from "react-native";
import IconButton from "./IconButton";
import { useTheme } from "../../store/theme-context";

const FiltersHeader = ({
  hasActiveFilters,
  onSortPress,
  onFilterPress,
  headerRightExtra,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn();

  return (
    <View style={styles.headerButtons}>
      {headerRightExtra?.()}
      {onSortPress && (
        <IconButton
          tintColor={Colors.textMain}
          onPress={onSortPress}
          icon="swap-vertical"
          style={styles.iconButton}
          size={24}
        />
      )}
      <IconButton
        tintColor={Colors.textMain}
        onPress={onFilterPress}
        icon={hasActiveFilters ? "options" : "options-outline"}
        active={hasActiveFilters}
        style={styles.iconButton}
        size={24}
      />
    </View>
  );
};

export default memo(FiltersHeader);

const stylesFn = () =>
  StyleSheet.create({
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 4,
    },
    iconButton: {
      marginRight: 0,
    },
  });
