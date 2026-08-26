import { FC, useCallback } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";

import WidgetError from "./WidgetError";
import { useTheme, ThemeColors } from "../../store/theme-context";
import { useList } from "../../hooks/useList";
import SpeciesThumb from "../Taxonomy/SpeciesThumb";
import { useOpenSpecies } from "../../hooks/useOpenSpecies";
import { formatDateShort, normalizeDistance } from "../../util/helpers";
import { fetchCommunityObservations } from "../../util/fetches";
import { Filters, AppStackNavigationProp, ObservationItem } from "../../types";
import { useAlertSettings } from "../../store/alert-settings-context";

const H_PAD = 16;
const IMAGE_SIZE = 48;

/**
 * The server takes the territory and the radius from the alert settings itself —
 * the same way the push mailout does (`ObservationFilterSet.filter_near` on the
 * backend). They used to be sent from here together with our own GPS fix, and
 * that caused two problems at once: the centre of the list did not match the
 * centre of the notifications, and without location permission there were no
 * coordinates at all — the backend silently ignored the radius and returned
 * rarities from all over the world under a "250 km" label.
 */
// `rare` too, and not only the scope: the feed also carries ordinary public
// observations of dibird users now, and a widget titled "rare nearby" must
// not quietly start listing sparrows.
const SCOPE_FILTERS: Filters = { near: "alerts", rare: true };

interface NewSpeciesProps {
  filters: Filters;
}

const RareNearby: FC<NewSpeciesProps> = ({ filters }) => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const openSpecies = useOpenSpecies();
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

  // The scope lives on the server but changes on the client — via the radius,
  // "locate me" and switching country. It is no longer in the filters, so it
  // would not be in the react-query key either: the list would stay assembled
  // from the previous settings until it goes stale.
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
          <View>
            <Text style={styles.groupLabel}>{t("rare_nearby")}</Text>
            {/* The scope row is part of the header, so the skeleton keeps its
                height: without it the title sat 20px lower and jumped up the
                moment the list arrived. */}
            <View style={styles.scopeRow}>
              <View
                style={styles.scopeSkeleton}
                testID="rare-nearby-scope-skeleton"
              />
            </View>
          </View>
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
  // The label is built from exactly what the server actually applied, not from
  // what is configured: a radius with no stored point has nothing to apply to,
  // and calling such a list "within 250 km" is a lie. With neither a point nor a
  // country there is no filter at all, and the only honest thing is to invite the
  // user to set one (tapping the label opens the alert settings).
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
          style={styles.scopeButton}
          onPress={() => navigation.navigate("AlertSettings")}
          hitSlop={8}
          testID="rare-nearby-scope"
        >
          <Text style={styles.groupLabel}>{t("rare_nearby")}</Text>
          {/* The scope is not a caption but the control that changes it, so it
              spells the action out: a grey line under the title read as a plain
              label, and the trip to the alert settings — the only place where
              the country and the radius are set — stayed invisible. With no
              scope at all the line is already an invitation, so it carries the
              accent colour on its own instead of a second "change". */}
          <View style={styles.scopeRow}>
            <Text
              style={[styles.scope, scope ? null : styles.scopeAction]}
              numberOfLines={1}
            >
              {scope ?? t("rare_nearby_set_location")}
            </Text>
            {scope ? (
              <Text style={styles.scopeAction}>
                {" · "}
                {t("rare_nearby_change")}
              </Text>
            ) : null}
          </View>
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
              <SpeciesThumb
                thumb={item.species_data.thumb}
                size={IMAGE_SIZE}
                radius={12}
                onPress={() =>
                  openSpecies(item.species_data.segment, "rare_nearby")
                }
                testID={`rare-nearby-species-thumb-${item.id}`}
              />
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
    // Long country names must eat their own row, not push "all →" off the edge.
    scopeButton: {
      flexShrink: 1,
    },
    scopeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: H_PAD,
      marginTop: 2,
      marginBottom: 8,
    },
    scope: {
      fontSize: 12,
      color: Colors.textSecondary,
      flexShrink: 1,
    },
    scopeSkeleton: {
      height: 14,
      width: 130,
      borderRadius: 4,
      backgroundColor: Colors.textMain,
      opacity: 0.15,
    },
    // A long country name is truncated instead of taking "change" down with it.
    scopeAction: {
      fontSize: 12,
      color: Colors.main100,
      flexShrink: 0,
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
    image: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
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
