import { useLayoutEffect, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../store/theme-context";
import { isoToFlagEmoji, formatDate, formatDateTime } from "../util/helpers";
import { StatBig } from "../components/Place/StatBig";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import Map from "../components/Map/Map";
import IconsHeader from "../components/ui/IconsHeader";

import { useItem, useUpdateItem, useDeleteItem } from "../hooks/useItem";
import { showError } from "../services/api";
import { useFilters } from "../store/filters-context";

const PlaceDetailScreen = ({ route, navigation }) => {
  const { placeId } = route.params;
  const type = "Place";

  const {
    data: place,
    isLoading,
    isError,
    error,
    refetch,
  } = useItem(placeId, type);

  const updateMutation = useUpdateItem(placeId, type);
  const deleteMutation = useDeleteItem(type);
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);
  const { date } = useFilters();

  const handleFavourite = useCallback(() => {
    if (!place) return;
    updateMutation.mutate(
      { favourite: !place.favourite },
      {
        onError: (e) => showError(e),
      },
    );
  }, [place, updateMutation.mutate]);

  const headerRightBeginning = useMemo(
    () => [
      {
        condition: !!place,
        onPress: () => navigation.navigate("PlaceEditor", { place }),
        icon: "create-outline",
        disabled: !place || updateMutation.isPending,
      },
      {
        condition: !!place,
        onPress: handleFavourite,
        icon: place?.favourite ? "heart" : "heart-outline",
        tintColor: Colors.main100,
        disabled: updateMutation.isPending || !place,
        loading: updateMutation.isPending,
      },
    ],
    [
      place,
      handleFavourite,
      updateMutation.isPending,
      navigation,
      Colors.main100,
    ],
  );

  const headerRight = () => (
    <IconsHeader headerRightBeginning={headerRightBeginning} />
  );

  const headerRightKey = `${headerRightBeginning?.length}${Colors.main100}`;

  const handleDelete = useCallback(() => {
    if (!place) return;
    Alert.alert(
      t("delete_title"),
      t("delete_place_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate(placeId, {
              onSuccess: () => navigation.goBack(),
              onError: (e) => {
                showError(e);
              },
            }),
        },
      ],
      { cancelable: true },
    );
  }, [place, placeId, deleteMutation, navigation]);

  const filtersOverride = useMemo(() => {
    if (!place) return null;
    return {
      territory: place.territory,
      place: placeId,
      date: date ?? null,
    };
  }, [place, placeId, date]);

  const handleObservationsPress = useCallback(() => {
    if (place && filtersOverride)
      navigation.push("Observations", {
        filtersOverride,
      });
  }, [place, filtersOverride, navigation]);

  const handleSpeciesPress = useCallback(() => {
    if (place && filtersOverride)
      navigation.push("Stat", {
        filtersOverride,
      });
  }, [place, filtersOverride, navigation]);

  const handleDiariesPress = useCallback(() => {
    if (place && filtersOverride)
      navigation.push("Diaries", {
        filtersOverride,
      });
  }, [place, filtersOverride, navigation]);

  useLayoutEffect(() => {
    if (!place) return;

    navigation.setOptions({
      title: "",
      headerRight,
    });
  }, [navigation, headerRightKey, place]);

  if (isError) {
    return (
      <ErrorOverlay
        title={t("places_unavailable")}
        message={error.message}
        onPress={refetch}
        logo
      />
    );
  }

  if (isLoading || !place) {
    return <LoadingOverlay />;
  }

  const [lng, lat] = place.location.coordinates;

  return (
    <>
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{place.name}</Text>
              <Text style={styles.subtitle}>
                {isoToFlagEmoji(place.territory_data.code)}{" "}
                {place.territory_data.name}
              </Text>
            </View>
          </View>

          <Map currentCoords={[lng, lat]} mapHeight={440} showCoords={true} />

          <View style={styles.footer}>
            <View style={styles.stats}>
              <StatBig
                icon="binoculars"
                value={place.observation_count}
                label={t("observations")}
                onPress={handleObservationsPress}
              />
              <StatBig
                value={place.species_count}
                label={t("species")}
                bird
                onPress={handleSpeciesPress}
              />
              <StatBig
                icon="book-outline"
                value={place.diary_count}
                label={t("diaries")}
                onPress={handleDiariesPress}
              />
            </View>

            <View style={[styles.meta, styles.metaBorder]}>
              <Text style={styles.metaText}>
                {t("created")}: {formatDateTime(place.created_at)}
              </Text>
              {formatDate(place.created_at) !==
                formatDate(place.updated_at) && (
                <Text style={styles.metaText}>
                  {t("updated")}: {formatDateTime(place.updated_at)}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>

        <FlatButtonBottom
          textColor={Colors.error600}
          onPress={handleDelete}
          icon="trash-outline"
          loading={deleteMutation.isPending}
        >
          {t("delete_place")}
        </FlatButtonBottom>
      </View>
    </>
  );
};

export default PlaceDetailScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.primary100,
      paddingBottom: 40,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: Colors.textMain,
    },
    subtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
      marginTop: 2,
      lineHeight: 28,
    },
    footer: {
      padding: 16,
    },
    stats: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    metaBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      paddingTop: 12,
    },
    metaText: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginBottom: 2,
    },
  });
