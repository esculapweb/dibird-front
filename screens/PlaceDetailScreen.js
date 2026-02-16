import { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../store/theme-context";
import { isoToFlagEmoji, formatDate } from "../util/fetches";
import { StatBig } from "../components/Place/StatBig";
import { MetaRow } from "../components/Place/MetaRow";
import IconButton from "../components/ui/IconButton";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import Map from "../components/Map/Map";

import { usePlace } from "../hooks/Place/usePlace";
import { useUpdatePlace, useDeletePlace } from "../hooks/Place/usePlaceMutation";
import { showError } from "../services/api";

const PlaceDetailScreen = ({ route, navigation }) => {
  const { placeId } = route.params;
  const { data: place, isLoading, isError, error, refetch } = usePlace(placeId);

  const updateMutation = useUpdatePlace(placeId);
  const deleteMutation = useDeletePlace();
  const { Colors } = useTheme();
  const { t } = useTranslation();

  const styles = stylesFn(Colors);

  const handleFavourite = useCallback(() => {
    if (!place) return;
    updateMutation.mutate(
      { favourite: !place.favourite },
      {
        onError: (e) => showError(e),
      },
    );
  }, [place, updateMutation]);

  const headerRight = useCallback(
    () => (
      <View style={styles.headerButtons}>
        <IconButton
          tintColor={Colors.textSecondary}
          icon="create-outline"
          onPress={() => navigation.navigate("PlaceEditor", { place })}
          style={styles.iconButton}
          size={24}
          disabled={!place || updateMutation.isPending}
        />
        <IconButton
          tintColor={Colors.accent}
          icon={place?.favourite ? "star" : "star-outline"}
          onPress={handleFavourite}
          style={styles.iconButton}
          size={24}
          disabled={updateMutation.isPending || !place}
          loading={updateMutation.isPending}
        />
      </View>
    ),
    [place, handleFavourite, updateMutation.isPending],
  );

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

  const handleObservationsPress = useCallback(() => {
    console.log("show observations");
  }, []);

  const handleSpeciesPress = useCallback(() => {
    if (place) {
      navigation.navigate("Statistics", { placeId });
    }
  }, [place, placeId, navigation]);

  const handleDiariesPress = useCallback(() => {
    console.log("show diaries");
  }, []);

  useEffect(() => {
    if (!place) return;

    navigation.setOptions({
      title: "",
      headerRight,
    });
  }, [navigation, headerRight, place]);

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

          <Map currentCoords={[lng, lat]} mapHeight={340} showCoords={true} />

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

            <View style={styles.meta}>
              <MetaRow
                label={t("created")}
                value={formatDate(place.created_at)}
              />
              <MetaRow
                label={t("updated")}
                value={formatDate(place.updated_at)}
              />
            </View>
          </View>
        </ScrollView>

        <FlatButtonBottom
          textColor={Colors.error600}
          onPress={handleDelete}
          icon="trash-outline"
          loading={deleteMutation.isPending}
        >
          {t("delete")}
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
      fontSize: 22,
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
    meta: {
      borderTopWidth: 1,
      borderColor: Colors.divider,
      paddingTop: 12,
    },
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    iconButton: {
      width: 36,
      marginRight: 0,
      justifyContent: "center",
      alignItems: "center",
    },
  });
