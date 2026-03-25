import { View, Pressable, Text, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../store/theme-context";

const SegmentedControl = ({ options, value, onChange }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.segment, isActive && styles.activeSegment]}
            onPress={() => {
              if (option.value === value) return;
              Haptics.selectionAsync();
              onChange(option.value);
            }}
          >
            <Text style={[styles.text, isActive && styles.activeText]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default SegmentedControl;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      backgroundColor: Colors.backgroundMain,
      borderBottomColor: Colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 6,
      alignItems: "center",
    },
    activeSegment: {
      backgroundColor: Colors.primary100,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Colors.tabActiveColor,
    },
    text: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
    activeText: {
      fontSize: 13,
      fontWeight: "500",
      color: Colors.tabActiveColor,
    },
  });
