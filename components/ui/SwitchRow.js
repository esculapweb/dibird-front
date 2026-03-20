import { StyleSheet, View, Text, Switch } from "react-native";
import { useTheme } from "../../store/theme-context";

/**
 * SwitchRow – replaces RadioGroup for simple boolean yes/no toggles.
 *
 * Props:
 *  - label:    string
 *  - value:    boolean
 *  - onChange: (newValue: boolean) => void
 */
const SwitchRow = ({ label, value, onChange }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: Colors.switchTrackOff ?? "#D1D1D6",
          true: Colors.accent ?? "#E8A020",
        }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={Colors.switchTrackOff ?? "#D1D1D6"}
      />
    </View>
  );
};

export default SwitchRow;

const stylesFn = (Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      minHeight: 52,
    },
    label: {
      flex: 1,
      fontSize: 14,
      fontWeight: "500",
      color: Colors.text ?? "#1A1714",
      lineHeight: 19,
      paddingRight: 16,
    },
  });
