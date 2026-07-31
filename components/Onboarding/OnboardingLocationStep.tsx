import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { useLocation } from "../../store/location-context";
import { useLocationUnavailable } from "../../hooks/useLocationUnavailable";
import { useAlertSettings } from "../../store/alert-settings-context";
import { requestPushPermission } from "../../hooks/usePushNotifications";
import { track } from "../../services/analytics";

/**
 * The "where do you watch" step: the only place in the flow where the app has a
 * sensible reason to ask for location — and before it appeared there was no such
 * place at all. The alerts card on the main screen only showed up with alerts
 * off, and on the backend they are on by default, so a newcomer never met a
 * single permission request and got "rarities nearby" from all over the world.
 *
 * Both permissions are asked for at once: the step is precisely about alerts on
 * rarities nearby, and without push they do not arrive, without coordinates they
 * are not about "nearby". The order is the same as in `AlertsCard`: push first,
 * then location.
 *
 * A refusal breaks nothing and locks nobody in: "Next" in the footer is always
 * enabled, the scope stays the country from the profile.
 */
const OnboardingLocationStep = ({ testID }: { testID?: string }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { requestLocation, getPermissionStatus } = useLocation();
  const { save } = useAlertSettings();
  const handleLocationUnavailable = useLocationUnavailable(
    t("location_unavailable_alert_hint"),
  );

  const [requesting, setRequesting] = useState(false);
  const [granted, setGranted] = useState(false);
  // Not `requesting`: the state only updates on the next render, and two taps in
  // a row land in the same one — both would see `false`.
  const inFlight = useRef(false);

  const handleAllow = async () => {
    if (inFlight.current || granted) return;
    inFlight.current = true;
    setRequesting(true);
    try {
      await requestPushPermission();

      const result = await requestLocation();
      if (!result) {
        if (getPermissionStatus() === "denied") handleLocationUnavailable();
        return;
      }

      // sync: the backend resolves the country from the coordinates right away
      // and returns it in the response. Without it the territory arrives via a
      // deferred task — and the very first screen after onboarding would show
      // "nearby" with no country.
      await save(
        {
          lat: Math.round(result.coords[1] * 100) / 100,
          lon: Math.round(result.coords[0] * 100) / 100,
        },
        true,
      );
      track("onboarding_location_set");
      setGranted(true);
    } finally {
      inFlight.current = false;
      setRequesting(false);
    }
  };

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.iconCircle}>
        <Ionicons
          name={granted ? "checkmark-circle" : "location-outline"}
          size={54}
          color={Colors.main100}
        />
      </View>

      <Text style={styles.title}>
        {granted
          ? t("onboarding_location_done_title")
          : t("onboarding_location_title")}
      </Text>
      <Text style={styles.text}>
        {granted
          ? t("onboarding_location_done_text")
          : t("onboarding_location_text")}
      </Text>

      {!granted && (
        <TouchableOpacity
          style={styles.button}
          onPress={handleAllow}
          disabled={requesting}
          activeOpacity={0.8}
          testID="onboarding-location-allow"
        >
          {requesting ? (
            <ActivityIndicator size="small" color={Colors.textOpposite} />
          ) : (
            <Text style={styles.buttonText}>{t("onboarding_location_allow")}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

export default OnboardingLocationStep;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    iconCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.main300,
      marginBottom: 32,
    },
    title: {
      fontSize: 22,
      fontWeight: "600",
      textAlign: "center",
      color: Colors.textMain,
      marginBottom: 12,
    },
    text: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      color: Colors.textSecondary,
    },
    button: {
      marginTop: 28,
      paddingHorizontal: 28,
      paddingVertical: 12,
      borderRadius: 12,
      minWidth: 200,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.main100,
    },
    buttonText: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textOpposite,
    },
  });
