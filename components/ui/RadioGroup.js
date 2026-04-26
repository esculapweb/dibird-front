import { View, Text, Pressable, StyleSheet } from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";

export const RadioGroup = ({
  value,
  label,
  options,
  onChange,
  direction = "column",
  disabled = false,
  isInvalid,
  style,
  disabledValues = [],
  onDisabledPress,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const isRow = direction === "row";

  return (
    <View style={style}>
      {label && (
        <Text style={[styles.title, isInvalid && styles.titleInvalid]}>
          {label}
        </Text>
      )}
      <View style={{ flexDirection: direction }}>
        {options.map((option, index) => {
          const checked = option.value === value;
          const isDisabled = disabled || disabledValues.includes(option.value);

          return (
            <Pressable
              key={option.value}
              onPress={() => {
                if (disabled) return;
                if (disabledValues.includes(option.value)) {
                  onDisabledPress?.(option.value);
                  return;
                }
                onChange(option.value);
              }}
              style={[
                styles.row,
                isDisabled && styles.disabled,
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

const stylesFn = (Colors: ThemeColors) =>
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
      borderColor: Colors.main100,
    },
    inner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Colors.main100,
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
