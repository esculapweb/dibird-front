import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const toastConfig = {
  success: ({ text1, text2, ...rest }) => (
    <View style={[styles.container, { backgroundColor: "rgba(0,128,0,0.7)" }]}>
      <Ionicons name="checkmark-circle" size={24} color="#fff" style={styles.icon} />
      <View style={styles.textWrapper}>
        <Text style={styles.text1}>{text1}</Text>
        {text2 ? <Text style={styles.text2}>{text2}</Text> : null}
      </View>
    </View>
  ),
  error: ({ text1, text2, ...rest }) => (
    <View style={[styles.container, { backgroundColor: "rgba(255,0,0,0.7)" }]}>
      <Ionicons name="close-circle" size={24} color="#fff" style={styles.icon} />
      <View style={styles.textWrapper}>
        <Text style={styles.text1}>{text1}</Text>
        {text2 ? <Text style={styles.text2}>{text2}</Text> : null}
      </View>
    </View>
  ),
  info: ({ text1, text2, ...rest }) => (
    <View style={[styles.container, { backgroundColor: "rgba(0,0,255,0.7)" }]}>
      <Ionicons name="information-circle" size={24} color="#fff" style={styles.icon} />
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
    shadowColor: "#000",
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
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  text2: {
    color: "#fff",
    fontSize: 14,
    marginTop: 2,
  },
});
