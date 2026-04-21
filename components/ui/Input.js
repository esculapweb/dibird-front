import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BirdSVG } from "./Svgs";

import { useTheme } from "../../store/theme-context";

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
  importantForAutofill,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const [isSecure, setIsSecure] = useState(secure);

  const toggleSecure = () => {
      setIsSecure((prev) => !prev);
  };

  return (
    <View style={styles.inputContainer}>
      {label && (<Text style={[styles.label, isInvalid && styles.labelInvalid]}>
        {label}
      </Text>)}
      <View style={[styles.inputWrapper, isInvalid && styles.inputInvalid]}>
        <TextInput
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
          importantForAutofill={importantForAutofill}
        />
        {secure && (
          <TouchableOpacity onPress={toggleSecure} style={styles.iconSecure}>
              <Ionicons
                name={isSecure ? "eye-off-outline" : "eye-outline"}
                size={24}
                color={Colors.textMain}
              />
          </TouchableOpacity>
        )}
        {icon && (
          <View style={styles.icon}>
            <Ionicons
              name={icon}
              size={20}
              color={Colors.textSecondary}
            />
          </View>
        )}
        {birdSvg && (
          <View style={styles.icon}>
            <BirdSVG
              size={20}
              color={Colors.textMain}
            />
          </View>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

export default Input;

const stylesFn = (Colors) =>
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
