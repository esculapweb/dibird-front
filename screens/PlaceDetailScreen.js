import { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
// import Toast from "react-native-toast-message";
import { useTranslation } from "react-i18next";

import { useTheme } from "../store/theme-context";
import { isoToFlagEmoji } from "../util/fetches";
import { StatBig } from "../components/Place/StatBig";
import { MetaRow } from "../components/Place/MetaRow";
import { formatDate } from "../util/fetches";
import IconButton from "../components/ui/IconButton";
import MapPreview from "../components/Map/MapPreview";
import api, { showError } from "../services/api";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import { usePlaces } from "../store/places-context";

const PlaceDetailScreen = ({ route, navigation }) => {
  const { place } = route.params;
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { t } = useTranslation();
  const [lng, lat] = place.location.coordinates;
  const url = `/myapi/place2/${place.id}/`;

  const { setFavouriteUpdate, favouriteUpdates } = usePlaces();
  const [loadingFav, setLoadingFav] = useState(false);

  const currentFavourite =
    favouriteUpdates[place.id] !== undefined
      ? favouriteUpdates[place.id]
      : place.favourite;

  const handleFavourite = useCallback(async () => {
    if (loadingFav) return;

    const prevFav = currentFavourite;
    const newFav = !prevFav;

    setFavouriteUpdate(place.id, newFav);
    setLoadingFav(true);

    try {
      await api.patch(url, { favourite: newFav });
    } catch (e) {
      setFavouriteUpdate(place.id, prevFav);
      showError(e);
    } finally {
      setLoadingFav(false);
    }
  }, [currentFavourite, loadingFav, place.id, url, setFavouriteUpdate]);

  const handleDelete = () => {
    Alert.alert(
      t("delete_title"),
      t("delete_place_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.delete(url);
              if (res?.status === 204) {
                navigation.navigate("Main", {
                  screen: "Places",
                });
              } else {
                showError({ response: res });
              }
            } catch (e) {
              showError(e);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleObservationsPress = () => {
    console.log("show observations");
    // navigation.navigate("Observations", { placeId: place.id });
  };

  const handleSpeciesPress = () => {
    // console.log("show stat");
    navigation.navigate("Main", {
      screen: "Statistics",
      params: { placeId: place.id },
    });
  };

  const handleDiariesPress = () => {
    console.log("show diaries");
    // navigation.navigate("Diary", { placeId: place.id });
  };

  useEffect(() => {
    navigation.setOptions({
      title: "",
      headerShadowVisible: false,
      headerRight: () => (
        <>
          <IconButton
            tintColor={Colors.accent}
            icon={currentFavourite ? "star" : "star-outline"}
            onPress={handleFavourite}
            style={styles.iconButton}
            size={24}
            disabled={loadingFav}
          />
        </>
      ),
    });
  }, [navigation, currentFavourite, loadingFav, handleFavourite]);

  return (
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

        {/* STATS */}
        <View style={styles.stats}>
          <StatBig
            icon="binoculars"
            value={place.observation_count}
            label="Observations"
            onPress={handleObservationsPress}
          />
          <StatBig
            value={place.species_count}
            label="Species"
            bird
            onPress={handleSpeciesPress}
          />
          <StatBig
            icon="book-outline"
            value={place.diary_count}
            label="Diary"
            onPress={handleDiariesPress}
          />
        </View>

        {/* META */}
        <View style={styles.meta}>
          <MetaRow label="Created" value={formatDate(place.created_at)} />
          <MetaRow label="Updated" value={formatDate(place.updated_at)} />
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

    iconButton: {
      width: 36,
      marginRight: 0,
      justifyContent: "center",
      alignItems: "center",
    },
  });
