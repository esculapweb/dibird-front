import { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../store/theme-context";
import { isoToFlagEmoji, formatDate } from "../util/helpers";

import { Config } from "../constants/config";
import IconButton from "../components/ui/IconButton";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import Map from "../components/Map/Map";
import { useObservation } from "../hooks/Observation/useObservation";
import { showError } from "../services/api";
import { BirdSVG } from "../components/ui/Svgs";
import { changeLanguage } from "i18next";

const ObservationDetailScreen = ({ route, navigation }) => {
  const { observationId } = route.params;

  const {
    data: observation,
    isLoading,
    isError,
    error,
    refetch,
  } = useObservation(observationId);

  // const deleteMutation = useDeleteObservation();
  const deleteMutation = () => console.log("delete");

  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);

  const handleDelete = useCallback(() => {
    if (!observation) return;

    Alert.alert(
      t("delete_title"),
      t("delete_observation_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate(observationId, {
              onSuccess: () => navigation.goBack(),
              onError: (e) => showError(e),
            }),
        },
      ],
      { cancelable: true },
    );
  }, [observation, observationId]);

  useEffect(() => {
    if (!observation) return;

    navigation.setOptions({
      title: "",
      headerRight: () => (
        <IconButton
          icon="create-outline"
          tintColor={Colors.textSecondary}
          onPress={() =>
            navigation.navigate("ObservationEditor", { observation })
          }
        />
      ),
    });
  }, [navigation, observation]);

  if (isError) {
    return (
      <ErrorOverlay
        title={t("observations_unavailable")}
        message={error.message}
        onPress={refetch}
        logo
      />
    );
  }

  if (isLoading || !observation) {
    return <LoadingOverlay />;
  }

  const name =
    observation.species_data.name_lang || observation.species_data.name;
  const latin = observation.species_data.name;
  const flag = isoToFlagEmoji(observation.territory_data.code);
  const territory = observation.territory_data.name;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.imageWrapper}>
            {observation?.species_data?.thumb ? (
              <Image
                source={{
                  uri: `${Config.baseUrl}/media/${observation.species_data.thumb}`,
                }}
                style={styles.image}
                contentFit="cover"
                cachePolicy="disk"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons
                  name="image-outline"
                  size={20}
                  color={Colors.dropdownIcon}
                />
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{name}</Text>
            </View>

            <Text style={styles.latin}>{latin}</Text>

            <Text style={styles.subtitle}>
              {flag} {territory}
            </Text>

            {observation.private && (
              <View style={styles.privacyRow}>
                <Text style={styles.privacyIcon}>🔒</Text>
                <Text style={styles.privacyText}>
                  {t("visible_only_to_you")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* CAPSULE ROW — DATE, TIME, QUANTITY */}
        <View style={styles.capsuleRow}>
          <View
            style={[styles.capsule, { backgroundColor: Colors.primary200 }]}
          >
            <Ionicons
              name="calendar-outline"
              size={14}
              color={Colors.textSecondary}
            />
            <Text style={styles.capsuleText}>
              {formatDate(observation.date_time)}
            </Text>
          </View>

          {observation.time && (
            <View
              style={[styles.capsule, { backgroundColor: Colors.primary200 }]}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={Colors.textSecondary}
              />
              <Text style={styles.capsuleText}>{observation.time}</Text>
            </View>
          )}

          {observation.quantity > 1 && (
            <View
              style={[styles.capsule, { backgroundColor: Colors.primary200 }]}
            >
              <BirdSVG size={14} color={Colors.textMain} />
              <Text style={styles.capsuleText}>{observation.quantity}</Text>
            </View>
          )}
        </View>

        {/* PLACE & MAP */}
        {observation?.place_data?.name && (
          <View style={styles.section}>
            <View style={styles.placeRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={Colors.textSecondary}
              />
              <Text style={styles.placeText}>
                {observation.place_data.name}
              </Text>
            </View>

            {observation?.place_data?.location?.coordinates?.length === 2 && (
              <Map
                currentCoords={observation.place_data.location.coordinates}
                mapHeight={320}
                showCoords={true}
              />
            )}
          </View>
        )}

        {observation?.diary_data && (
          <View style={styles.diaryContext}>
            <Ionicons
              name="book-outline"
              size={18}
              color={Colors.textSecondary}
              style={{ marginRight: 10 }}
            />

            <View style={{ flex: 1 }}>
              <Text style={styles.diaryLabel}>{t("diary_entry")}</Text>

              <Text style={styles.diaryTitle}>
                {observation.diary_data?.name ||
                  formatDate(observation.date_time)}
              </Text>
            </View>
          </View>
        )}

        {/* NOTES */}
        {observation.notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesLabel}>{t("notes")}</Text>
            <Text style={styles.notes}>{observation.notes}</Text>
          </View>
        )}

        {/* META */}
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {t("created")}: {formatDate(observation.created_at)}
          </Text>
          <Text style={styles.metaText}>
            {t("updated")}: {formatDate(observation.updated_at)}
          </Text>
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
  );
};

export default ObservationDetailScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.primary100,
    },
    header: {
      flexDirection: "row",
      padding: 16,
      alignItems: "center",
    },
    imageWrapper: {
      width: 90,
      height: 90,
      marginRight: 16,
    },
    image: {
      width: 90,
      height: 90,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },
    imagePlaceholder: {
      width: 90,
      height: 90,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
      justifyContent: "center",
      alignItems: "center",
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 2,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: Colors.textMain,
      marginRight: 6,
    },
    lock: {
      fontSize: 16,
    },
    latin: {
      fontSize: 14,
      fontStyle: "italic",
      color: Colors.textSecondary,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 14,
      color: Colors.textSecondary,
    },
    capsuleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      gap: 8,
    },
    capsule: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.accent,
      gap: 4,
      maxWidth: 200,
    },
    capsuleText: {
      fontSize: 12,
      fontWeight: "500",
      color: Colors.textMain,
    },
    section: {
      marginTop: 16,
      paddingHorizontal: 16,
    },
    placeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
      gap: 6,
    },
    placeText: {
      fontSize: 14,
      color: Colors.textMain,
    },
    notesBlock: {
      marginTop: 16,
      paddingLeft: 16,
    },
    notesLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginBottom: 4,
    },
    notes: {
      fontSize: 14,
      color: Colors.textMain,
      lineHeight: 20,
    },
    meta: {
      marginTop: 24,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    metaText: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginBottom: 2,
    },

    diaryContext: {
      flexDirection: "row",
      alignItems: "center",
      padding: 0,
      // marginHorizontal: 16,
      marginTop: 20,
      // paddingVertical: 14,
      paddingHorizontal: 16,
      // borderRadius: 16,
      // backgroundColor: Colors.primary100,
      // borderLeftWidth: 4,
      // borderWidth: 1,
      // borderColor: Colors.accent,
    },

    diaryLabel: {
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: Colors.textSecondary,
      marginBottom: 2,
    },

    diaryTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
    },

    privacyRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
    },

    privacyIcon: {
      fontSize: 13,
      marginRight: 4,
    },

    privacyText: {
      fontSize: 13,
      color: Colors.textSecondary,
    },
  });
