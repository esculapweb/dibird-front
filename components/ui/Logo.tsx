import {
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { StyleType } from "../../types";

const Logo = ({
  style,
  imageSize = 100,
  withText = false,
}: {
  style?: StyleType;
  imageSize?: number;
  withText?: boolean;
}) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors, imageSize);
  return (
    <View style={[styles.imageContainer, style]}>
      <View style={styles.logo}>
        <Image source={require("../../assets/icon.png")} style={styles.image} />
      </View>
      {withText && (
        <Text style={styles.logoText}>
          <Text style={styles.logoAccent}>Di</Text>Bird
        </Text>
      )}
    </View>
  );
};

export default Logo;

const stylesFn = (Colors: ThemeColors, imageSize: number) =>
  StyleSheet.create({
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
      width: imageSize,
      height: imageSize,
      borderRadius: 8,
    },
    logoText: {
      fontSize: 18,
      fontWeight: "bold",
      color: Colors.logoText,
      marginLeft: 8,
    },
    logoAccent: {
      color: Colors.logoAccent,
    },
  });
