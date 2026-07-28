import { FC, useCallback } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

import WidgetError from "./WidgetError";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { useList } from "../../hooks/useList";
import { Config } from "../../constants/config";
import { BirdSVG } from "../ui/Svgs";
import { formatDateShort, normalizeDistance } from "../../util/helpers";
import { fetchCommunityObservations } from "../../util/fetches";
import { Filters, AppStackNavigationProp, ObservationItem } from "../../types";
import { useAlertSettings } from "../../store/alert-settings-context";

const H_PAD = 16;
const IMAGE_SIZE = 48;

/**
 * Территорию и радиус сервер берёт из настроек алертов сам — тем же способом,
 * что и рассылка пушей (`ObservationFilterSet.filter_near` на бэке). Раньше
 * их слали отсюда вместе со своим GPS-фиксом, и это давало сразу две беды:
 * центр списка не совпадал с центром уведомлений, а без разрешения на
 * геолокацию координат не было вовсе — бэк молча игнорировал радиус и отдавал
 * редкости всего мира под подписью «250 км».
 */
const SCOPE_FILTERS: Filters = { near: "alerts" };

interface NewSpeciesProps {
  filters: Filters;
}

const RareNearby: FC<NewSpeciesProps> = ({ filters }) => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { settings } = useAlertSettings();

  const fetchDataWrapper = useCallback(
    (filters: Filters, sort: string | null, search: string, page: number) => {
      return fetchCommunityObservations(filters, sort, search, page, null, 3);
    },
    [],
  );

  // Скоуп живёт на сервере, но меняется на клиенте — радиусом, «определить
  // меня» и сменой страны. В фильтрах его больше нет, значит и в ключе
  // react-query бы не осталось: список так и висел бы собранным по прежним
  // настройкам, пока не протухнет.
  const scopeKey = settings
    ? [
        settings.territory_data?.id ?? "",
        settings.radius_km,
        settings.location_lat ?? "",
        settings.location_lon ?? "",
      ].join(":")
    : null;

  const {
    data: communityData,
    isLoading,
    isError,
    refetch,
  } = useList({
    screenName: "RareNearby",
    fetchFunction: fetchDataWrapper,
    filters: SCOPE_FILTERS,
    sort: "-date_time",
    queryKeyExtra: scopeKey,
    enabled: !!settings,
  });


  const data = communityData?.pages?.[0]?.results?.slice(0, 3) ?? [];

  const handleNavigate = (item: ObservationItem) => {
    navigation.navigate("CommunityDetail", {
      observationId: item.id,
    });
  };

  if (isLoading) {
    return (
      <>
        <View style={styles.sectionHeader}>
          <Text style={styles.groupLabel}>{t("rare_nearby")}</Text>
        </View>
        <View style={styles.nsList}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.nsRow, i < 2 ? styles.nsRowDivider : null]}
            >
              <View
                style={[
                  styles.image,
                  { opacity: 0.2, backgroundColor: Colors.textMain },
                ]}
              />
              <View style={[styles.nsNames, { gap: 6 }]}>
                <View
                  style={{
                    height: 15,
                    width: "60%",
                    borderRadius: 4,
                    backgroundColor: Colors.textMain,
                    opacity: 0.2,
                  }}
                />
                <View
                  style={{
                    height: 13,
                    width: "40%",
                    borderRadius: 4,
                    backgroundColor: Colors.textMain,
                    opacity: 0.1,
                  }}
                />
              </View>
              <View
                style={{
                  height: 13,
                  width: 40,
                  borderRadius: 4,
                  backgroundColor: Colors.textMain,
                  opacity: 0.2,
                }}
              />
            </View>
          ))}
        </View>
      </>
    );
  }

  if (isError && data.length === 0)
    return <WidgetError title={t("rare_nearby")} onRetry={refetch} />;
  if (data.length === 0) return null;

  // This block deliberately ignores the header's territory filter: "nearby"
  // means the territory and radius from the alert settings. Say so, and make
  // the label the way to change it — otherwise switching country in the
  // header looks broken when this list doesn't move.
  //
  // It also deliberately ignores `settings.is_enabled`, and keeps showing the
  // list when alerts are off: that flag governs *push notifications*, and who
  // is around right now is worth reading either way. AlertsCard above says so
  // in those terms — "you won't be notified", never "alerts are off", which
  // next to a working list would read as the two being out of sync.
  //
  // Подпись строится ровно из того, что сервер применил на самом деле, а не
  // из того, что настроено: радиус без сохранённой точки применить не к чему,
  // и называть такой список «в 250 км» — врать. Без точки и без страны
  // фильтра нет вовсе, и единственное честное — позвать её указать (тап по
  // подписи ведёт в настройки алертов).
  const radiusLabel =
    settings?.location_lat != null && settings?.location_lon != null
      ? normalizeDistance(settings.radius_km * 1000)
      : null;
  const scope =
    [settings?.territory_data?.name, radiusLabel].filter(Boolean).join(", ") ||
    null;

  return (
    <>
      <View style={styles.sectionHeader}>
        <TouchableOpacity
          onPress={() => navigation.navigate("AlertSettings")}
          hitSlop={8}
          testID="rare-nearby-scope"
        >
          <Text style={styles.groupLabel}>{t("rare_nearby")}</Text>
          <Text style={styles.scope} numberOfLines={1}>
            {scope ?? t("rare_nearby_set_location")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate("Community", {
              filtersOverride: {
                ...filters,
                territory: settings?.territory_data?.id,
                species: null,
                place: null,
              },
            })
          }
          hitSlop={8}
        >
          <Text style={styles.seeAll}>{t("all")} →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nsList}>
        {data.map((item, i) => {
          const dateShort = formatDateShort(item.date_time);
          if (!dateShort) return null;
          const { d } = dateShort;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.nsRow,
                i < data.length - 1 ? styles.nsRowDivider : null,
              ]}
              activeOpacity={0.7}
              onPress={() => handleNavigate(item)}
            >
              <View style={styles.imageWrapper}>
                {item.species_data.thumb ? (
                  <Image
                    source={{
                      uri: `${Config.mediaUrl}/${item.species_data.thumb}`,
                    }}
                    style={styles.image}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <BirdSVG size={26} color={Colors.textSecondary} />
                  </View>
                )}
              </View>
              <View style={styles.nsNames}>
                <Text style={styles.nsCommon} numberOfLines={2}>
                  {item.species_data.name_lang}
                </Text>
                <Text style={styles.nsLatin} numberOfLines={1}>
                  {item.species_data.name}
                </Text>
              </View>
              
              {item?.distance && 
                <View style={styles.rightRow}>
                    <Text style={styles.nsDate}>{d}</Text>
                    <Text style={styles.distance}>
                    {normalizeDistance(item.distance)}
                    </Text>
                </View>}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
};

export default RareNearby;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
      marginBottom: 0,
    },
    groupLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
      marginLeft: H_PAD,
    },
    scope: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginLeft: H_PAD,
      marginTop: 1,
      marginBottom: 8,
    },
    seeAll: {
      fontSize: 14,
      fontWeight: "500",
      marginRight: H_PAD,
      color: Colors.main100,
    },
    nsList: {
      marginHorizontal: H_PAD,
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 12,
    },
    nsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: Colors.primary100,
    },
    nsRowDivider: {
      borderBottomWidth: 0.5,
      borderBottomColor: Colors.divider,
    },
    imageWrapper: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
    },
    image: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },
    imagePlaceholder: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
      justifyContent: "center",
      alignItems: "center",
    },
    nsNames: { flex: 1 },
    nsCommon: {
      fontSize: 15,
      fontWeight: "500",
      color: Colors.textMain,
    },
    nsLatin: {
      fontSize: 13,
      color: Colors.textSecondary,
      fontStyle: "italic",
      marginTop: 2,
    },
    nsDate: {
      fontSize: 13,
      color: Colors.textSecondary,
      flexShrink: 0,
      textAlign: "right",
    },
    distance: {
      fontSize: 12,
      color: Colors.main100,
    },
    rightRow: {
      alignItems: "flex-end",
      justifyContent: "center",
      flex: 1,
      gap: 4,
    },
  });
