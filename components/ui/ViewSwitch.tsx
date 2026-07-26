import { StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { IconType } from "../../types";

export interface ViewSwitchOption<T extends string> {
  value: T;
  label: string;
  icon: IconType;
}

interface ViewSwitchProps<T extends string> {
  options: ViewSwitchOption<T>[];
  value: T;
  onChange: (next: T) => void;
  // Prefixes each option's testID ("species-view-tree").
  testIDPrefix: string;
}

// Two ways of laying out the same list — the taxonomic tree or a plain list.
// Not the bottom Tabs: those switch what the screen is about, this only
// switches how one list reads, so it sits with the list it belongs to.
const ViewSwitch = <T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: ViewSwitchProps<T>) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onChange(option.value)}
            testID={`${testIDPrefix}-${option.value}`}
          >
            <Ionicons
              name={option.icon}
              size={15}
              color={isActive ? Colors.main100 : Colors.textSecondary}
            />
            <Text style={[styles.text, isActive && styles.textActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default ViewSwitch;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 8,
    },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: Colors.primary100,
    },
    tabActive: { backgroundColor: Colors.main300 },
    text: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.textSecondary,
    },
    textActive: { color: Colors.main100 },
  });
