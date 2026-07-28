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
import { track } from "../../services/analytics";
import { AppStackNavigationProp } from "../../types";

const H_PAD = 16;

/**
 * Алерты о редких птицах рядом — главное УТП приложения, и до сих пор
 * единственным способом узнать о них было самому дойти до бургер-меню и
 * настроек. Карточка показывается в двух случаях: алерты выключены — или
 * включены, но не знают, где пользователь.
 *
 * Второй случай долго был невидимым: `is_enabled` на бэке по умолчанию `true`,
 * поэтому у нового аккаунта карточка не появлялась вовсе — а вместе с ней и
 * единственный повод дать разрешения. Точки при этом нет, и «поблизости»
 * означало «где угодно» (см. RareNearby).
 *
 * Текст — про то, что **не придёт уведомление**, а не «алерты выключены»: блок
 * «редкие рядом» прямо под карточкой продолжает работать и при выключенных
 * алертах (см. комментарий в RareNearby), и «выключено» рядом с работающим
 * списком читалось бы как рассинхрон.
 *
 * Здесь же просятся оба разрешения — это первый момент вне онбординга, когда
 * у пользователя есть повод их дать.
 */
const AlertsCard = () => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { settings, save } = useAlertSettings();
  const { requestLocation, getPermissionStatus } = useLocation();
  const handleLocationUnavailable = useLocationUnavailable(
    t("location_unavailable_alert_hint"),
  );
  const [enabling, setEnabling] = useState(false);

  // `settings` нет, пока они не загрузились или пользователь не залогинен —
  // мигать карточкой в это время нельзя.
  const needsEnable = !!settings && !settings.is_enabled;
  const needsLocation = !!settings && settings.location_lat == null;
  if (!settings || (!needsEnable && !needsLocation)) return null;

  const handleEnable = async () => {
    if (enabling) return;
    setEnabling(true);
    try {
      // Пуши первыми: без них алерты не доедут вовсе, а геопозиция лишь уточняет
      // радиус — она у настроек может быть уже проставлена страной профиля.
      await requestPushPermission();

      const result = await requestLocation();
      if (result) {
        // sync: с ним бэк тут же резолвит страну по координатам и отдаёт её в
        // ответе. Без него территория доезжает отложенной задачей, и подпись
        // у списка «поблизости» осталась бы прежней до следующего запуска.
        await save(
          {
            lat: Math.round(result.coords[1] * 100) / 100,
            lon: Math.round(result.coords[0] * 100) / 100,
          },
          true,
        );
      } else if (getPermissionStatus() === "denied") {
        // Отказ в системном диалоге второй раз не переспросить — дальше
        // только настройки ОС, и сказать об этом должен кто-то один.
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

  return (
    <View style={styles.card} testID="alerts-card">
      <View style={styles.header}>
        <Ionicons name="notifications" size={22} color={Colors.main100} />
        <View style={styles.titles}>
          <Text style={styles.title}>
            {needsEnable ? t("alerts_card_title") : t("alerts_card_where_title")}
          </Text>
          <Text style={styles.subtitle}>
            {needsEnable ? t("alerts_card_text") : t("alerts_card_where_text")}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.action, styles.actionPrimary]}
          onPress={handleEnable}
          disabled={enabling}
          testID="alerts-card-enable"
        >
          <Text style={[styles.actionText, styles.actionTextPrimary]}>
            {needsEnable ? t("alerts_card_enable") : t("alerts_card_locate")}
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
