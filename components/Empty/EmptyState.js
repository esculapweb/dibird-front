import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../store/theme-context";
import FlatButton from "../ui/FlatButton";


const EmptyState = ({
  icon = "alert-circle-outline",
  message = "Пусто",
  actions = [],
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color={Colors.textSecondary} />
      <Text style={styles.message}>{message}</Text>

      {actions.map((action, i) => (
        <FlatButton key={i} onPress={action.onPress} style={{ marginTop: 12 }}>
          {action.label}
        </FlatButton>
      ))}
    </View>
  );
};

export default EmptyState;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      marginTop: 60,
    },
    message: {
      marginTop: 12,
      color: Colors.textSecondary,
      textAlign: "center",
    },
  });
