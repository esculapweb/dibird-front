import { StyleSheet, Text, View, Image } from "react-native";

import { Colors } from "../../constants/styles";

const Logo = ({ style, imageSize = 100, withText = false }) => {
  return (
    <View style={[styles.imageContainer, style]}>
      <View style={styles.logo}>
        <Image
          source={require("../../assets/logo-dibird-512.png")}
          style={[styles.image, { width: imageSize, height: imageSize, borderRadius: 8 }]}
        />
      </View>
      {withText && <Text style={styles.logoText}>
        <Text style={styles.logoAccent}>Di</Text>Bird
      </Text>}
    </View>
  );
};

export default Logo;

const styles = StyleSheet.create({
  imageContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    flexDirection: "row",
  },
  image: {
    resizeMode: "contain",
    marginRight: 8,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.logoText,
  },
  logoAccent: {
    color: Colors.logoAccent,
  },
});
