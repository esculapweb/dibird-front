import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  KeyboardTypeOptions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BirdSVG } from "./Svgs";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { IconType } from "../../types";

interface InputProps {
  label?: string;
  keyboardType?: KeyboardTypeOptions;
  secure?: boolean;
  onUpdateValue: (value: string) => void;
  value: string;
  isInvalid?: boolean;
  error?: string;
  multiline?: boolean;
  icon?: IconType;
  birdSvg?: boolean;
  placeholder?: string;
  textContentType?: TextInputProps["textContentType"];
  autoComplete?: TextInputProps["autoComplete"];
  testID?: string;
}

const Input = ({
  label,
  keyboardType,
  secure,
  onUpdateValue,
  value,
  isInvalid,
  error,
  multiline,
  icon,
  birdSvg,
  placeholder,
  textContentType,
  autoComplete,
  testID,
}: InputProps) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [isSecure, setIsSecure] = useState(secure);

  const toggleSecure = () => {
    setIsSecure((prev) => !prev);
  };

  return (
    <View style={styles.inputContainer}>
      {label && (
        <Text style={[styles.label, isInvalid && styles.labelInvalid]}>
          {label}
        </Text>
      )}
      <View style={[styles.inputWrapper, isInvalid && styles.inputInvalid]}>
        <TextInput
          testID={testID}
          style={[styles.input, isInvalid && styles.inputInvalid]}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          secureTextEntry={isSecure}
          onChangeText={onUpdateValue}
          value={value}
          multiline={multiline}
          placeholder={placeholder}
          placeholderTextColor={Colors.textSecondary}
          textContentType={textContentType}
          autoComplete={autoComplete}
        />
        {secure && (
          <TouchableOpacity
            onPress={toggleSecure}
            style={styles.iconSecure}
            testID={testID ? `${testID}-toggle-visibility` : undefined}
          >
            <Ionicons
              name={isSecure ? "eye-off-outline" : "eye-outline"}
              size={24}
              color={Colors.textMain}
            />
          </TouchableOpacity>
        )}
        {icon && (
          <Ionicons name={icon} size={20} color={Colors.textSecondary} />
        )}
        {birdSvg && <BirdSVG size={20} color={Colors.textMain} />}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

export default Input;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    inputContainer: {
      marginBottom: 16,
    },
    label: {
      color: Colors.textMain,
      marginBottom: 4,
    },
    labelInvalid: {
      color: Colors.error500,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderColor: Colors.border,
      borderWidth: 1,
      backgroundColor: Colors.primary100,
      borderRadius: 4,
      paddingHorizontal: 8,
    },
    input: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 16,
      color: Colors.textMain,
    },
    inputInvalid: {
      backgroundColor: Colors.error100,
      borderColor: Colors.error500,
    },
    iconSecure: {
      marginLeft: 4,
    },
    errorText: {
      fontSize: 13,
      color: Colors.error500,
      marginTop: 6,
      marginLeft: 4,
    },
  });
