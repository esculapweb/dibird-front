import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../store/theme-context";
import { isoToFlagEmoji, formatDate } from "../util/fetches";
import { StatBig } from "../components/Place/StatBig";
import { MetaRow } from "../components/Place/MetaRow";
import IconButton from "../components/ui/IconButton";
import MapPreview from "../components/Map/MapPreview";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";

import { usePlace } from "../hooks/usePlace";
import { useUpdatePlace, useDeletePlace } from "../hooks/usePlaceMutation";
import EditPlaceModal from "../components/Place/EditPlaceModal";

const PlaceDetailScreen = ({ route, navigation }) => {
  const { placeId } = route.params;
  const { data: place, isLoading, isError, error, refetch } = usePlace(placeId);

  const [editModalVisible, setEditModalVisible] = useState(false);

  const updateMutation = useUpdatePlace(placeId);
  const deletePlace = useDeletePlace();
  const { Colors } = useTheme();
  const { t } = useTranslation();

  const styles = stylesFn(Colors);

  const handleFavourite = useCallback(() => {
    if (!place) return;
    updateMutation.mutate(
      { favourite: !place.favourite },
      {
        onError: (error) => {
          // Можно показать toast или alert
          console.error("Failed to toggle favourite:", error);
          // Или: Alert.alert(t("error"), t("favourite_update_failed"));
        },
      },
    );
  }, [place, updateMutation]);

  const handleSaveEdit = useCallback(
    (updateData) => {
      updateMutation.mutate(updateData, {
        onSuccess: () => {
          setEditModalVisible(false);
          // Можно показать уведомление об успехе
        },
        onError: (error) => {
          Alert.alert(t("error"), error.message || t("update_failed"));
        },
      });
    },
    [updateMutation, t],
  );

  const headerRight = useCallback(
    () => (
      <View style={styles.headerButtons}>
        <IconButton
          tintColor={Colors.textSecondary}
          icon="create-outline"
          onPress={() => setEditModalVisible(true)}
          style={styles.iconButton}
          size={24}
          disabled={!place || updateMutation.isLoading}
        />
        <IconButton
          tintColor={Colors.accent}
          icon={place?.favourite ? "star" : "star-outline"}
          onPress={handleFavourite}
          style={styles.iconButton}
          size={24}
          disabled={updateMutation.isLoading || !place}
        />
      </View>
    ),
    [place?.favourite, handleFavourite, updateMutation.isLoading],
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
            deletePlace.mutate(placeId, {
              onSuccess: () =>
                navigation.navigate("Places"),
              onError: (error) => {
                Alert.alert(t("error"), error.message || t("delete_failed"));
              },
            }),
        },
      ],
      { cancelable: true },
    );
  }, [place, placeId, deletePlace, navigation]);

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
    navigation.setOptions({
      title: "",
      headerShadowVisible: false,
      headerRight: place ? headerRight : undefined,
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
      {updateMutation.isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}
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

          <View style={styles.mapWrapper}>
            <MapPreview coordinates={[lng, lat]} />
            <View style={styles.coordsRow}>
              <Ionicons
                name="navigate-outline"
                size={14}
                color={Colors.textSecondary}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.coords}>
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </Text>
            </View>
          </View>

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
              label={t("diary")}
              onPress={handleDiariesPress}
            />
          </View>

          {/* Meta */}
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
        </ScrollView>

        <FlatButtonBottom
          textColor={Colors.error600}
          onPress={handleDelete}
          icon="trash-outline"
        >
          {t("delete")}
        </FlatButtonBottom>
      </View>
      <EditPlaceModal
        visible={editModalVisible}
        place={place}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveEdit}
        isLoading={updateMutation.isLoading}
      />
    </>
  );
};

export default PlaceDetailScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.backgroundMain,
      padding: 16,
      paddingBottom: 40,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
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
    },
    mapWrapper: {
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: Colors.imageBg,
      marginBottom: 16,
    },
    coordsRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 8,
    },
    coords: {
      fontSize: 12,
      color: Colors.textSecondary,
    },
    stats: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginVertical: 16,
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
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(255,255,255,0.7)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    },
  });
