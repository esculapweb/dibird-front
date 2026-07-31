import { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { ThemeColors, useTheme } from "../store/theme-context";
import Layout from "../components/ui/Layout";
import Logo from "../components/ui/Logo";
import AuthOptions from "../components/Auth/AuthOptions";
import AuthAgreement from "../components/Auth/AuthAgreement";
import { WelcomeScreenNavigationProp, AuthStackNavigationProp } from "../types";
import FloatingHeader from "../components/ui/FloatingHeader";
import { track } from "../services/analytics";

const WelcomeScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, insets);
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const stackNav = navigation.getParent<AuthStackNavigationProp>();

  const handleGuestBrowse = () => {
    track("guest_browse_started", { source: "welcome" });
    // A flat species list rather than the tree of orders: a newcomer has no
    // question of "which order", they have a bird they want to find by name.
    stackNav?.navigate("Taxonomy", { rank: 5, title: t("species_catalog") });
  };

  // The top of the funnel: how many installs reached the first screen at all.
  useEffect(() => {
    track("welcome_viewed");
  }, []);

  const Agreement = () => (
    <View style={styles.agreement}>
      <AuthAgreement onOpen={(screen) => stackNav?.navigate(screen)} />
    </View>
  );

  return (
    <Layout bottom={<Agreement />}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Logo withText={false} style={styles.logoBox} />
          <Text style={styles.title}>{t("welcome")}</Text>
          <Text style={styles.subtitle}>{t("sign_in_or_create")}</Text>
        </View>

        <View style={styles.buttons}>
          <AuthOptions onEmailPress={() => stackNav?.navigate("Login")} />

          {/* The catalogue needs no account: before signing up the user had
              nothing to look at, and installs dropped off at the login wall. */}
          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuestBrowse}
          >
            <Ionicons
              name="book-outline"
              size={18}
              color={Colors.textMiddle}
            />
            <Text style={styles.guestButtonText}>
              {t("guest_browse_catalog")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <FloatingHeader />
    </Layout>
  );
};

const stylesFn = (Colors: ThemeColors, insets: EdgeInsets) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 28,
      paddingBottom: insets.bottom,
    },
    header: {
      alignItems: "center",
      marginBottom: 48,
    },
    logoBox: {
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: "500",
      marginBottom: 6,
      color: Colors.main100,
    },
    subtitle: {
      fontSize: 14,
      color: Colors.textMiddle,
    },
    buttons: {
      gap: 12,
    },
    // No border and no background: this is an exit from the signup funnel, it
    // must not compete for attention with the sign-in buttons above it.
    guestButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      marginTop: 4,
    },
    guestButtonText: {
      fontSize: 14,
      color: Colors.textMiddle,
    },
    agreement: {
      paddingTop: 6,
      paddingBottom: insets.bottom,
      marginHorizontal: 28,
      borderTopColor: Colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    menuButton: {
      position: "absolute",
      top: insets.top + 12,
      right: 16,
      zIndex: 10,
    },
  });

export default WelcomeScreen;
