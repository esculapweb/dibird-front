import { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../../store/theme-context";
import { useAlertSettings } from "../../store/alert-settings-context";
import { useLocation } from "../../store/location-context";
import { useLocationUnavailable } from "../../hooks/useLocationUnavailable";
import { requestPushPermission } from "../../hooks/usePushNotifications";
import { usePushPermissionStatus } from "../../hooks/usePushPermissionStatus";
import { track } from "../../services/analytics";
import { AppStackNavigationProp } from "../../types";

const H_PAD = 16;

/**
 * Alerts about rare birds nearby are the app's main selling point, and until now
 * the only way to learn about them was to find the burger menu and the settings
 * yourself. The card shows up in three cases: alerts are off — they are on but
 * the OS is blocking the notifications — or they are on but do not know where
 * the user is.
 *
 * The third case has no other way out at all. The permission is only ever asked
 * for from the onboarding and from turning the alerts *on*, and both are behind
 * someone whose alerts are already on: the onboarding runs on sign-up only, and
 * the switch is not going to be flipped twice. Meanwhile the OS drops the
 * permission on every reinstall — while the session survives in the Keychain, so
 * the app comes up signed in with nothing looking out of place. Push then stayed
 * dead until a logout/login, which re-fetches the Expo token on its way out.
 *
 * The second case stayed invisible for a long time: `is_enabled` defaults to
 * `true` on the backend, so a new account never saw the card — and with it the
 * only reason to grant the permissions. There is no location either, so
 * "nearby" meant "anywhere" (see RareNearby).
 *
 * The copy is about **no notification arriving**, not about "alerts are off":
 * the "rare nearby" block right below the card keeps working with alerts off
 * (see the comment in RareNearby), and "off" next to a working list would read
 * as the two being out of sync.
 *
 * Both permissions are asked for here as well — this is the first moment outside
 * onboarding where the user has a reason to grant them.
 */
const AlertsCard = () => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { settings, save } = useAlertSettings();
  const { requestLocation, getPermissionStatus } = useLocation();
  const { status: pushStatus, request: requestPush } =
    usePushPermissionStatus();
  const handleLocationUnavailable = useLocationUnavailable(
    t("location_unavailable_alert_hint"),
  );
  const [enabling, setEnabling] = useState(false);

  // `settings` is absent until they have loaded or while the user is signed out —
  // flashing the card in the meantime is not an option.
  const needsEnable = !!settings && !settings.is_enabled;
  // `pushStatus` is null while it is being read and on a simulator; neither is a
  // reason to announce that the notifications are blocked.
  const needsPush =
    !!settings &&
    settings.is_enabled &&
    pushStatus != null &&
    pushStatus !== "granted";
  const needsLocation = !!settings && settings.location_lat == null;
  if (!settings || (!needsEnable && !needsPush && !needsLocation)) return null;

  // The order is the one from `handleEnable`: without the permission nothing
  // arrives at all, while the location only refines the radius.
  const variant = needsEnable ? "enable" : needsPush ? "push" : "location";

  // Nothing to save here: the settings are on already, it is the OS that says no.
  // Whether that means a dialog or a trip to the system settings is the hook's
  // call — the alert settings screen offers the same thing.
  const handlePush = async () => {
    if (enabling) return;
    setEnabling(true);
    try {
      await requestPush();
    } finally {
      setEnabling(false);
    }
  };

  const handleEnable = async () => {
    if (enabling) return;
    setEnabling(true);
    try {
      // Push first: without it alerts do not arrive at all, while the location
      // only refines the radius — the settings may already have it from the
      // profile country.
      await requestPushPermission();

      const result = await requestLocation();
      if (result) {
        // sync: with it the backend resolves the country from the coordinates
        // right away and returns it in the response. Without it the territory
        // arrives via a deferred task, and the label of the "nearby" list would
        // stay as it was until the next launch.
        await save(
          {
            lat: Math.round(result.coords[1] * 100) / 100,
            lon: Math.round(result.coords[0] * 100) / 100,
          },
          true,
        );
      } else if (getPermissionStatus() === "denied") {
        // A refusal in the system dialog cannot be asked a second time — from
        // here on it is OS settings only, and exactly one place should say so.
        handleLocationUnavailable();
      }

      if (needsEnable) {
        track("alerts_enabled", { source: "main_card" });
        await save({ is_enabled: true });
      }
    } finally {
      setEnabling(false);
    }
  };

  // Spelled out per variant rather than assembled from keys: i18next-parser only
  // sees literal t() calls, and a key it cannot see is a key `npm run i18n:unused`
  // reports as dead.
  const copy =
    variant === "enable"
      ? {
          title: t("alerts_card_title"),
          text: t("alerts_card_text"),
          action: t("alerts_card_enable"),
        }
      : variant === "push"
        ? {
            title: t("alerts_card_blocked_title"),
            text: t("alerts_card_blocked_text"),
            action:
              pushStatus === "denied"
                ? t("open_settings")
                : t("alerts_card_allow"),
          }
        : {
            title: t("alerts_card_where_title"),
            text: t("alerts_card_where_text"),
            action: t("alerts_card_locate"),
          };

  return (
    <View style={styles.card} testID="alerts-card">
      <View style={styles.header}>
        <Ionicons
          name={variant === "push" ? "notifications-off" : "notifications"}
          size={22}
          color={Colors.main100}
        />
        <View style={styles.titles}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.text}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, styles.actionPrimary]}
          onPress={variant === "push" ? handlePush : handleEnable}
          disabled={enabling}
          testID="alerts-card-enable"
        >
          <Text style={[styles.actionText, styles.actionTextPrimary]}>
            {copy.action}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.action}
          onPress={() => navigation.navigate("AlertSettings")}
          testID="alerts-card-settings"
        >
          <Text style={styles.actionText}>{t("alerts_card_settings")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AlertsCard;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      marginHorizontal: H_PAD,
      marginBottom: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor: Colors.primary100,
    },
    header: { flexDirection: "row", alignItems: "center", gap: 10 },
    titles: { flex: 1 },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
    },
    subtitle: {
      fontSize: 12,
      lineHeight: 17,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    actions: { flexDirection: "row", gap: 8, marginTop: 12 },
    action: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: Colors.main300,
    },
    actionPrimary: { backgroundColor: Colors.main100 },
    actionText: {
      fontSize: 13,
      fontWeight: "600",
      color: Colors.main100,
    },
    actionTextPrimary: { color: Colors.textOpposite },
  });
