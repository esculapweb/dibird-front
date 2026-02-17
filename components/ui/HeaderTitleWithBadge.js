import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../store/theme-context";

const HeaderTitleWithBadge = ({ title, badgeCount }) => {
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
      {badgeCount !== undefined && badgeCount !== null && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount}</Text>
        </View>
      )}
    </View>
  );
};

export default HeaderTitleWithBadge;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: Colors.textMain,
      flexShrink: 1,
    },
    badge: {
      marginLeft: 6,
      minWidth: 16,
      height: 16,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 5,
      backgroundColor: Colors.primary200,
    },
    badgeText: {
      color: Colors.textMain,
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 12,
      textAlign: "center",
    },
  });
