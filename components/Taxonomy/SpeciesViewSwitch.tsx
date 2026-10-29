import { StyleSheet, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import ViewSwitch, { ViewSwitchOption } from "../ui/ViewSwitch";
import { useTheme, ThemeColors } from "../../store/theme-context";

interface SpeciesViewSwitchProps<T extends string> {
  options: ViewSwitchOption<T>[];
  value: T;
  onChange: (next: T) => void;
  testIDPrefix: string;
  // The captions toggle only means something over the grid, so it appears
  // only while the photos layout is on.
  isPhotos: boolean;
  showCaptions: boolean;
  onToggleCaptions: () => void;
}

// ViewSwitch for a species list, with the website's "Species names" switch
// beside it. Same row, so turning the grid on and its names off happens in
// one place rather than in a sheet behind the header.
const SpeciesViewSwitch = <T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
  isPhotos,
  showCaptions,
  onToggleCaptions,
}: SpeciesViewSwitchProps<T>) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.row}>
      <View style={styles.switch}>
        <ViewSwitch
          options={options}
          value={value}
          onChange={onChange}
          testIDPrefix={testIDPrefix}
        />
      </View>
      {isPhotos && (
        <Pressable
          onPress={onToggleCaptions}
          style={[styles.toggle, showCaptions && styles.toggleActive]}
          accessibilityRole="switch"
          accessibilityState={{ checked: showCaptions }}
          accessibilityLabel={
            showCaptions ? t("hide_species_names") : t("show_species_names")
          }
          testID="species-captions-toggle"
        >
          <Ionicons
            name="text-outline"
            size={16}
            color={showCaptions ? Colors.main100 : Colors.textSecondary}
          />
        </Pressable>
      )}
    </View>
  );
};

export default SpeciesViewSwitch;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: 6 },
    switch: { flex: 1 },
    // Matches a ViewSwitch tab: same height, radius and colours, and the same
    // bottom margin ViewSwitch puts under its own row.
    toggle: {
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 12,
      marginBottom: 8,
      borderRadius: 10,
      backgroundColor: Colors.primary100,
    },
    toggleActive: { backgroundColor: Colors.main300 },
  });
