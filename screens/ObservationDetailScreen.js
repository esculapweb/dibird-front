import { useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../store/theme-context";
import { isoToFlagEmoji, formatDate, formatDateTime } from "../util/helpers";

import { Config } from "../constants/config";
import IconButton from "../components/ui/IconButton";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import Map from "../components/Map/Map";
import { useItem, useUpdateItem, useDeleteItem } from "../hooks/useItem";
import { showError } from "../services/api";
import { BirdSVG } from "../components/ui/Svgs";
import { formatTimeString } from "../util/timeHelpers";

const ObservationDetailScreen = ({ route, navigation }) => {
  const { observationId } = route.params;
  const type = "Observation";

  const {
    data: observation,
    isLoading,
    isError,
    error,
    refetch,
  } = useItem(observationId, type);

  const updateMutation = useUpdateItem(observationId, type);
  const deleteMutation = useDeleteItem(type);

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

  const headerRight = useCallback(
    () => (
      <IconButton
        icon="create-outline"
        onPress={() =>
          navigation.navigate("ObservationEditor", { observation })
        }
        style={styles.headerButton}
        size={24}
        disabled={!observation || updateMutation.isPending}
        color={Colors.textSecondary}
      />
    ),
    [observation, updateMutation.isPending],
  );

  useEffect(() => {
    if (!observation) return;

    navigation.setOptions({
      title: "",
      headerRight,
    });
  }, [navigation, headerRight, observation]);

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

  if (isLoading || !observation) return <LoadingOverlay />;

  const name =
    observation.species_data.name_lang || observation.species_data.name;
  const latin = observation.species_data.name;
  const flag = isoToFlagEmoji(observation.territory_data.code);
  const territory = observation.territory_data.name;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* HEADER */}
        <View style={[styles.section, styles.header]}>
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
            <Text style={styles.title}>{name}</Text>
            <Text style={styles.latin}>{latin}</Text>

            {observation.private ? (
              <View style={styles.privacyRow}>
                <Text style={styles.privacyIcon}>🔒</Text>
                <Text style={styles.privacyText}>
                  {t("visible_only_to_you")}
                </Text>
              </View>
            ) : (
              <View style={styles.privacyRow}>
                <Text style={styles.privacyIcon}>🌐</Text>
                <Text style={styles.privacyText}>
                  {t("visible_to_everyone")}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* CAPSULES */}
        <View style={styles.capsuleRow}>
          <View style={styles.capsule}>
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
            <View style={styles.capsule}>
              <Ionicons
                name="time-outline"
                size={14}
                color={Colors.textSecondary}
              />
              <Text style={styles.capsuleText}>{formatTimeString(observation.time)}</Text>
            </View>
          )}

          {observation.quantity && (
            <View style={styles.capsule}>
              <BirdSVG size={14} color={Colors.textMain} />
              <Text style={styles.capsuleText}>{observation.quantity}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          {/* PLACE */}
          {observation?.place_data && (
            <View style={styles.placeWrap}>
              <Text style={styles.placeName}>
                {observation.place_data.name}
              </Text>
              <Text style={styles.placeTerritory}>
                {flag} {territory}
              </Text>
              {observation?.place_data?.location?.coordinates?.length === 2 && (
                <View style={{ borderRadius: 12, overflow: "hidden" }}>
                  <Map
                    currentCoords={observation.place_data.location.coordinates}
                    mapHeight={300}
                    showCoords={true}
                  />
                </View>
              )}
            </View>
          )}

          {/* DIARY */}
          {observation?.diary_data && (
            <View style={styles.diaryBlock}>
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
          {observation?.notes && (
            <View style={styles.notesBlock}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={Colors.textSecondary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.notes}>{observation.notes}</Text>
            </View>
          )}

          {/* META */}
          <View
            style={[
              styles.meta,
              (observation.notes ||
                observation?.diary_data ||
                observation?.place_data) &&
                styles.metaBorder,
            ]}
          >
            <Text style={styles.metaText}>
              {t("created")}: {formatDateTime(observation.created_at)}
            </Text>
            {formatDate(observation.created_at) !==
              formatDate(observation.updated_at) && (
              <Text style={styles.metaText}>
                {t("updated")}: {formatDateTime(observation.updated_at)}
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
      backgroundColor: Colors.backgroundMain,
      padding: 12,
    },
    section: {
      padding: 12,
      backgroundColor: Colors.primary100,
      borderRadius: 12,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    header: {
      flexDirection: "row",
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
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: Colors.textMain,
    },
    latin: {
      fontSize: 14,
      fontStyle: "italic",
      color: Colors.textSecondary,
      marginTop: 2,
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
    capsuleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingVertical: 12,
      gap: 8,
    },
    capsule: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: Colors.primary100,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.primary200,
      gap: 4,
      maxWidth: 200,
    },
    capsuleText: {
      fontSize: 12,
      fontWeight: "500",
      color: Colors.textMain,
    },
    placeWrap: {
      marginBottom: 12,
    },
    placeName: {
      fontSize: 15,
      fontWeight: "600",
      color: Colors.textMain,
    },
    placeTerritory: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
      marginBottom: 8,
    },
    diaryBlock: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    diaryLabel: {
      fontSize: 11,
      color: Colors.textSecondary,
      textTransform: "uppercase",
      marginBottom: 2,
      letterSpacing: 0.5,
    },
    diaryTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: Colors.textMain,
    },
    notesBlock: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    notes: {
      fontSize: 14,
      color: Colors.textMain,
      lineHeight: 20,
      flex: 1,
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
    headerButton: {
      width: 36,
      height: 36,
      marginRight: 0,
      justifyContent: "center",
      alignItems: "center",
    },
  });
