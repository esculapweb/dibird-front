import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "../../constants/styles";

function Input({
  label,
  keyboardType,
  secure,
  onUpdateValue,
  value,
  isInvalid,
}) {
  const [isSecure, setIsSecure] = useState(secure);

  const iconOpacity = useRef(new Animated.Value(1)).current;
  const toggleSecure = () => {
    Animated.timing(iconOpacity, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setIsSecure(prev => !prev);
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  };


  return (
    <View style={styles.inputContainer}>
      <Text style={[styles.label, isInvalid && styles.labelInvalid]}>
        {label}
      </Text>
      <View style={[styles.inputWrapper, isInvalid && styles.inputInvalid]}>
        <TextInput
          style={[styles.input, isInvalid && styles.inputInvalid]}
          autoCapitalize="none"
          keyboardType={keyboardType}
          secureTextEntry={isSecure}
          onChangeText={onUpdateValue}
          value={value}
        />
        {secure && (
          <TouchableOpacity onPress={toggleSecure} style={styles.icon}>
            <Animated.View style={{opacity: iconOpacity}}>
              <Ionicons
                name={isSecure ? "eye-off-outline" : "eye-outline"}
                size={24}
                color={Colors.textMain}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default Input;

const styles = StyleSheet.create({
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
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  inputInvalid: {
    backgroundColor: Colors.error100,
    borderColor: Colors.error500,
  },
  icon: {
    marginLeft: 8,
  },
});
