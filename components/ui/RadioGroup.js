import { View, Text, Pressable, StyleSheet } from "react-native";

import { useTheme } from "../../store/theme-context";

export const RadioGroup = ({
  value,
  label,
  options,
  onChange,
  direction = "column",
  disabled = false,
  isInvalid,
  style,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const isRow = direction === "row";

  return (
    <View style={style}>
      <Text style={[styles.title, isInvalid && styles.titleInvalid]}>
        {label}
      </Text>
      <View style={{ flexDirection: direction }}>
        {options.map((option, index) => {
          const checked = option.value === value;

          return (
            <Pressable
              key={option.value}
              onPress={() => !disabled && onChange(option.value)}
              style={[
                styles.row,
                disabled && styles.disabled,
                isRow
                  ? index < options.length - 1 && styles.rowHorizontal
                  : styles.rowVertical,
              ]}
            >
              <View style={[styles.outer, checked && styles.outerChecked]}>
                {checked && <View style={styles.inner} />}
              </View>
              <Text style={styles.label}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default RadioGroup;

const stylesFn = (Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
    },
    rowVertical: {
      marginBottom: 12,
    },
    rowHorizontal: {
      marginRight: 24,
    },
    outer: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: Colors.radioBorder,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 6,
    },
    outerChecked: {
      borderColor: Colors.accent,
    },
    inner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.accent,
    },
    label: {
      fontSize: 16,
      color: Colors.textMain,
    },
    disabled: {
      opacity: 0.5,
    },
    title: {
      color: Colors.textMain,
      marginBottom: 8,
    },
    titleInvalid: {
      color: Colors.error500,
    },
  });
