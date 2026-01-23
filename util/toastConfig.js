import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "../constants/styles";

export const toastConfig = {
  success: ({ text1, text2, ...rest }) => (
    <View style={[styles.container, { backgroundColor: Colors.toastSuccess }]}>
      <Ionicons name="checkmark-circle" size={24} color={Colors.primary100} style={styles.icon} />
      <View style={styles.textWrapper}>
        <Text style={styles.text1}>{text1}</Text>
        {text2 ? <Text style={styles.text2}>{text2}</Text> : null}
      </View>
    </View>
  ),
  error: ({ text1, text2, ...rest }) => (
    <View style={[styles.container, { backgroundColor: Colors.toastError }]}>
      <Ionicons name="close-circle" size={24} color={Colors.primary100} style={styles.icon} />
      <View style={styles.textWrapper}>
        <Text style={styles.text1}>{text1}</Text>
        {text2 ? <Text style={styles.text2}>{text2}</Text> : null}
      </View>
    </View>
  ),
  info: ({ text1, text2, ...rest }) => (
    <View style={[styles.container, { backgroundColor: Colors.toastInfo }]}>
      <Ionicons name="information-circle" size={24} color={Colors.primary100} style={styles.icon} />
      <View style={styles.textWrapper}>
        <Text style={styles.text1}>{text1}</Text>
        {text2 ? <Text style={styles.text2}>{text2}</Text> : null}
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    width: "90%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: Colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  icon: {
    marginRight: 12,
  },
  textWrapper: {
    flex: 1,
  },
  text1: {
    color: Colors.primary100,
    fontWeight: "bold",
    fontSize: 16,
  },
  text2: {
    color: Colors.primary100,
    fontSize: 14,
    marginTop: 2,
  },
});
