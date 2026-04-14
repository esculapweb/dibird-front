import {
  Pressable,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../store/theme-context";

const FlatButtonBottom = ({
  children,
  onPress = () => {},
  textColor,
  icon,
  loading,
  savedLabel,
}) => {
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, insets);
  const displaySaved = !!savedLabel;


  if (loading)
    return (
      <View style={styles.flatButtonContainer}>
        <ActivityIndicator
          size="small"
          color={textColor ? textColor : Colors.main100}
        />
      </View>
    );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.flatButtonContainer,
        pressed && styles.pressed,
        { backgroundColor: displaySaved ? Colors.main300 : Colors.primary100 },
      ]}
    >
      <View style={styles.buttonInner}>
        {icon && (
          <Ionicons
            name={displaySaved ? "checkmark-circle-outline" : icon}
            size={18}
            color={textColor ?? Colors.main100}
          />
        )}
        <Text style={[styles.buttonText, textColor && { color: textColor }]}>
          {displaySaved ? savedLabel : children}
        </Text>
      </View>
    </Pressable>
  );
};

export default FlatButtonBottom;

const stylesFn = (Colors, insets) =>
  StyleSheet.create({
    pressed: {
      opacity: 0.7,
    },
    buttonText: {
      fontSize: 16,
      textAlign: "center",
      color: Colors.main100,
    },
    flatButtonContainer: {
      padding: 18,
      paddingBottom: Math.max(16, insets.bottom),
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    buttonInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
  });
