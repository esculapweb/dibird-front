import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Animated } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../store/theme-context";

const { width } = Dimensions.get("window");

const MainScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();

  const buttonData = [
    { title: t("statistics"), icon: "stats-chart", screen: "Stat" },
    { title: t("places"), icon: "location", screen: "Places" },
    
  ];

  return (
    <View style={[styles.rootContainer, { backgroundColor: Colors.backgroundMain }]}>
      <View style={styles.buttonsContainer}>
        {buttonData.map((btn) => (
          <PressableCard
            key={btn.screen}
            title={btn.title}
            icon={btn.icon}
            onPress={() => navigation.navigate(btn.screen)}
            Colors={Colors}
          />
        ))}
      </View>
    </View>
  );
};

export default MainScreen;

// --- Отдельный компонент кнопки с анимацией ---
const PressableCard = ({ title, icon, onPress, Colors }) => {
  const scale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 24 }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient
          colors={[Colors.primary300, Colors.primary200]}
          start={[0, 0]}
          end={[1, 1]}
          style={[styles.buttonCard, { backgroundColor: Colors.primary200 }]}
        >
          <Ionicons name={icon} size={48} color={Colors.accent} style={styles.buttonIcon} />
          <Text style={[styles.buttonText, { color: Colors.textMain }]}>{title}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 32,
    textAlign: "center",
  },
  buttonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  buttonCard: {
    width: width * 0.42,
    aspectRatio: 1,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    padding: 16,
  },
  buttonIcon: {
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
