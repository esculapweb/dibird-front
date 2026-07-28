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
 * Шаг «где вы наблюдаете»: единственное место в потоке, где у приложения есть
 * внятный повод попросить геолокацию — и до его появления такого места не было
 * вовсе. Карточка алертов на главной показывалась только при выключенных
 * алертах, а на бэке они включены по умолчанию, так что новичок не встречал
 * ни одного запроса разрешений и получал «редкости поблизости» со всего мира.
 *
 * Просим оба разрешения сразу: шаг именно про оповещения о редкостях рядом, а
 * без пушей они не доедут, без координат — не про «рядом». Порядок как в
 * `AlertsCard`: сначала пуши, потом гео.
 *
 * Отказ ничего не ломает и никуда не запирает: «Далее» в футере активна
 * всегда, скоуп останется страной из профиля.
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
  // Не `requesting`: состояние обновится только следующим рендером, а два
  // тапа подряд приходят в один и тот же — и оба видели бы `false`.
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

      // sync: бэк тут же резолвит страну по координатам и отдаёт её в ответе.
      // Без него территория доезжает отложенной задачей — и первый же экран
      // после онбординга показал бы «поблизости» без страны.
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
