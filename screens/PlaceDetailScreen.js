import { useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Clipboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
// import Clipboard from "@react-native-clipboard/clipboard";

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

const PlaceDetailScreen = ({ route, navigation }) => {
  const { placeId } = route.params;
  const { data: place, isLoading, isError, error, refetch } = usePlace(placeId);

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

  const headerRight = useCallback(
    () => (
      <View style={styles.headerButtons}>
        <IconButton
          tintColor={Colors.textSecondary}
          icon="create-outline"
          onPress={() => navigation.navigate("PlaceEditor", { place })}
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
              onSuccess: () => navigation.goBack(),
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
    if (!place) return;

    navigation.setOptions({
      title: "",
      headerShadowVisible: false,
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

  if (isLoading || !place || updateMutation.isLoading) {
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

          <View style={styles.mapWrapper}>
            <MapPreview coordinates={[lng, lat]} />

            <TouchableOpacity
              style={styles.coordsOverlay}
              onPress={() => {
                const coordsText = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                Clipboard.setString(coordsText);
                Toast.show({
                  type: "success",
                  text1: t("coordinates_copied"),
                  text2: coordsText,
                  position: "bottom",
                  visibilityTime: 1500,
                });
              }}
            >
              <Text style={styles.coordsOverlayText}>
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </Text>
              <Ionicons
                name="copy-outline"
                size={16}
                color={Colors.textSecondary}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          </View>

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
                label={t("diary")}
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
      marginTop: 16,
      marginBottom: 8,
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
    mapWrapper: {
      overflow: "hidden",
      backgroundColor: Colors.imageBg,
      borderRadius: 16,
      marginHorizontal: 16,
      marginBottom: 16,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    footer: {
      paddingHorizontal: 16,
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
    coordsOverlay: {
      position: "absolute",
      bottom: 16,
      right: 16,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: Colors.overlayBg,
      borderRadius: 12,
    },
    coordsOverlayText: {
      fontSize: 12,
      color: Colors.textSecondary,
      fontWeight: "500",
    },
  });
