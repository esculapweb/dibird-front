import {
  Pressable,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";

const FlatButtonBottom = ({
  children,
  onPress,
  textColor,
  icon,
  loading,
  savedLabel,
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const displaySaved = !!savedLabel;

  if (loading)
    return (
      <View style={styles.flatButtonContainer}>
        <ActivityIndicator
          size="small"
          color={textColor ? textColor : Colors.link}
        />
      </View>
    );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.flatButtonContainer,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.buttonInner}>
        {icon && (
          <Ionicons
            name={displaySaved ? "checkmark-circle-outline" : icon}
            size={22}
            color={
              displaySaved ? Colors.toastSuccess : (textColor ?? Colors.link)
            }
          />
        )}
        <Text
          style={[
            styles.buttonText,
            textColor && { color: textColor },
            displaySaved && { color: Colors.toastSuccess },
          ]}
        >
          {displaySaved ? savedLabel : children}
        </Text>
      </View>
    </Pressable>
  );
};

export default FlatButtonBottom;

const stylesFn = (Colors) =>
  StyleSheet.create({
    pressed: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: 16,
      textAlign: "center",
      color: Colors.link,
    },
    flatButtonContainer: {
      padding: 18,
      paddingBottom: 28,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      backgroundColor: Colors.primary100,
    },
    buttonInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
  });
