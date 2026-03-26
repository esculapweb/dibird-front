import { useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../store/theme-context";

const { width } = Dimensions.get("window");

const MainScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const buttonData = [
    { title: t("statistics"), icon: "stats-chart", screen: "Stat" },
    { title: t("checklist"), icon: "checkbox-outline", screen: "Checklist" },
    { title: t("places"), icon: "location", screen: "Places" },
    { title: t("observations"), icon: "binoculars", screen: "Observations" },
    { title: t("diaries"), icon: "book", screen: "Diaries" },
    // { title: t("rating"), icon: "book", screen: "Diaries" },
  ];

  const today = new Date();
  const dateOptions = { weekday: "long", day: "numeric", month: "long" };
  const formattedDate = today.toLocaleDateString("ru-RU", dateOptions);
  const capitalizedDate =
    formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <View
      style={[styles.rootContainer, { backgroundColor: Colors.backgroundMain }]}
    >
      <View style={styles.backgroundBlob1} />
      <View style={styles.backgroundBlob2} />
      <View style={styles.backgroundBlob3} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeEmoji}>🦩</Text>
          <View>
            <Text style={styles.welcomeText}>{t("hello")}</Text>
            <Text style={styles.dateText}>{capitalizedDate}</Text>
          </View>
        </View>

        <View style={styles.quoteContainer}>
          <LinearGradient
            colors={[Colors.mainQuoteBg1, Colors.mainQuoteBg2]}
            start={[0, 0]}
            end={[1, 1]}
            style={styles.quoteCard}
          >
            <Ionicons
              name="leaf"
              size={24}
              color={Colors.mainCardAccent}
              style={styles.quoteIcon}
            />
            <Text style={styles.quoteText}>{t("daily_quote")}</Text>
          </LinearGradient>
        </View>

        <Text style={styles.sectionTitle}>{t("your_tools")}</Text>

        <View style={styles.organicContainer}>
          {buttonData.map((btn, index) => (
            <PressableCardOrganic
              key={btn.screen}
              title={btn.title}
              icon={btn.icon}
              index={index}
              onPress={() => navigation.navigate(btn.screen)}
              Colors={Colors}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default MainScreen;

const PressableCardOrganic = ({ title, icon, index, onPress, Colors }) => {
  const scale = new Animated.Value(1);
  const translateY = new Animated.Value(0);
  const styles = stylesFn(Colors);

  const getBorderRadius = (idx) => {
    const radii = [
      { tl: 30, tr: 50, br: 30, bl: 50 },
      { tl: 50, tr: 30, bl: 30, br: 50 },
      { tl: 40, tr: 40, br: 60, bl: 30 },
      { tl: 60, tr: 30, br: 40, bl: 40 },
    ];
    return radii[idx % radii.length];
  };

  const radiusStyle = getBorderRadius(index);
  const delay = index * 100;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -6,
          duration: 2000,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        transform: [{ scale }, { translateY }],
        marginBottom: 20,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={() => {
          Animated.spring(scale, {
            toValue: 0.92,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }).start();
        }}
      >
        <LinearGradient
          colors={[Colors.mainCardBg1, Colors.mainCardBg2]}
          start={[0, 0]}
          end={[1, 1]}
          style={[
            styles.organicCard,
            {
              borderTopLeftRadius: radiusStyle.tl,
              borderTopRightRadius: radiusStyle.tr,
              borderBottomRightRadius: radiusStyle.br,
              borderBottomLeftRadius: radiusStyle.bl,
            },
          ]}
        >
          <View
            style={[styles.organicDot, { backgroundColor: Colors.mainCardDot }]}
          />

          <LinearGradient
            colors={[Colors.mainCardIconBg1, Colors.mainCardIconBg2]}
            start={[0, 0]}
            end={[1, 1]}
            style={styles.organicIconContainer}
          >
            <Ionicons name={icon} size={42} color={Colors.mainCardAccent} />
          </LinearGradient>

          <Text style={styles.organicTitle}>{title}</Text>

          <View
            style={[
              styles.organicWave,
              { backgroundColor: Colors.mainCardWave },
            ]}
          />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const stylesFn = (Colors) =>
  StyleSheet.create({
    rootContainer: {
      flex: 1,
      backgroundColor: Colors.backgroundMain,
    },
    scrollContent: {
      paddingBottom: 30,
    },
    backgroundBlob1: {
      position: "absolute",
      width: 250,
      height: 250,
      borderRadius: 100,
      top: -50,
      right: -80,
      opacity: 0.6,
      transform: [{ rotate: "25deg" }],
      backgroundColor: Colors.mainBlob1,
    },
    backgroundBlob2: {
      position: "absolute",
      width: 200,
      height: 200,
      borderRadius: 60,
      bottom: 100,
      left: -60,
      opacity: 0.5,
      transform: [{ rotate: "-15deg" }],
      backgroundColor: Colors.mainBlob2,
    },
    backgroundBlob3: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: 50,
      top: "40%",
      right: -40,
      opacity: 0.4,
      transform: [{ rotate: "45deg" }],
      backgroundColor: Colors.mainBlob3,
    },
    welcomeSection: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 24,
      marginBottom: 24,
    },
    welcomeEmoji: {
      fontSize: 44,
      marginRight: 16,
    },
    welcomeText: {
      fontSize: 16,
      fontWeight: "500",
      marginBottom: 4,
      color: Colors.textSecondary,
    },
    dateText: {
      fontSize: 22,
      fontWeight: "700",
      color: Colors.mainTextDate,
    },
    quoteContainer: {
      paddingHorizontal: 24,
      marginBottom: 40,
    },
    quoteCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 20,
      borderRadius: 24,
      borderLeftWidth: 4,
      borderWidth: 1,
      borderColor: Colors.mainQuoteBorder,
      backgroundColor: Colors.mainQuoteBg1,
    },
    quoteIcon: {
      marginRight: 12,
    },
    quoteText: {
      flex: 1,
      fontSize: 15,
      fontStyle: "italic",
      lineHeight: 22,
      color: Colors.textSecondary,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      marginLeft: 24,
      marginBottom: 20,
      color: Colors.textMain,
    },
    organicContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-around",
      paddingHorizontal: 12,
    },
    organicCard: {
      width: width * 0.42,
      aspectRatio: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      shadowColor: Colors.shadow,
      elevation: 8,
      overflow: "hidden",
      position: "relative",
      backgroundColor: Colors.mainCardBg1,
    },
    organicIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 25,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
      transform: [{ rotate: "-5deg" }],
    },
    organicTitle: {
      fontSize: 18,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.mainTextPrimary,
    },
    organicDot: {
      position: "absolute",
      top: 15,
      right: 20,
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    organicWave: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      height: 8,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
  });
