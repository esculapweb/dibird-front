import { useLayoutEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../store/theme-context";
import { formatDate, formatDateTime, formatDateLong } from "../util/helpers";
import { Config } from "../constants/config";
import IconButton from "../components/ui/IconButton";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { useItem, useUpdateItem, useDeleteItem } from "../hooks/useItem";
import { showError } from "../services/api";
import { BirdSVG } from "../components/ui/Svgs";
import { formatTimeString } from "../util/timeHelpers";
import { isoToFlagEmoji } from "../util/helpers";
import Section from "../components/ui/Section";
import PrivacyToggle from "../components/ui/PrivacyToggle";
import Map from "../components/Map/Map";

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
      <View style={styles.headerButtons}>
        <IconButton
          icon="create-outline"
          onPress={() =>
            observation.diary
              ? navigation.navigate("DiaryObservationEditor", {
                  observation,
                  diaryId: observation.diary,
                  territoryValue: observation.territory,
                })
              : navigation.navigate("ObservationEditor", {
                  observation: {
                    ...observation,
                    date_time:
                      observation.date_time instanceof Date
                        ? observation.date_time.toISOString()
                        : observation.date_time,
                  },
                })
          }
          style={styles.iconButton}
          size={24}
          disabled={!observation || updateMutation.isPending}
          tintColor={Colors.textSecondary}
        />
      </View>
    ),
    [observation, updateMutation.isPending],
  );

  useLayoutEffect(() => {
    if (!observation) return;

    navigation.setOptions({
      title: t("observation"),
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

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <Section
          title={t("section_main")}
          hintBlock={<PrivacyToggle value={observation.private} />}
        >
          <View style={styles.header}>
            <View style={styles.imageWrapper}>
              {observation?.species_data?.thumb ? (
                <Image
                  source={{
                    uri: `${Config.mediaUrl}/${observation.species_data.thumb}`,
                  }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <BirdSVG size={40} color={Colors.textSecondary} />
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.title}>{name}</Text>
                <Text style={styles.latin}>{latin}</Text>

                <View style={styles.capsule}>
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.capsuleText}>
                    {formatDateLong(observation.date_time)}
                  </Text>
                  {observation.time && (
                    <Text style={styles.capsuleText}>
                      {formatTimeString(observation.time)}
                    </Text>
                  )}
                </View>

                {observation.quantity && (
                  <View style={styles.capsule}>
                    <BirdSVG size={14} color={Colors.textMain} />
                    <Text style={styles.capsuleText}>
                      {observation.quantity}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.dividerLine} />

          <Pressable
            style={({ pressed }) => [
              styles.placeRow,
              pressed && { opacity: 0.6 },
            ]}
            onPress={() =>
              observation?.place_data?.id &&
              navigation.navigate("PlaceDetail", {
                placeId: observation.place_data.id,
              })
            }
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.placeName} numberOfLines={2}>
                  {observation?.place_data?.name || t("location_not_specified")}
                </Text>
                <Text style={styles.placeTerritory} numberOfLines={1}>
                  {isoToFlagEmoji(observation?.territory_data?.code)}{" "}
                  {observation?.territory_data?.name}
                </Text>
              </View>
              {observation?.place_data?.id && (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.textSecondary}
                />
              )}
            </View>
          </Pressable>

          {observation?.place_data?.location?.coordinates && (
            <View style={styles.mapWrapper}>
              <Map
                currentCoords={observation.place_data.location.coordinates}
                currentZoom={13}
                mapHeight={200}
                showCoords={true}
              />
            </View>
          )}
        </Section>

        <Section title={t("section_details")}>
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

          {observation?.diary_data && (
            <Pressable
              style={({ pressed }) => [
                styles.diaryBlock,
                pressed && { opacity: 0.6 },
              ]}
              onPress={() =>
                observation?.diary &&
                navigation.navigate("DiaryDetail", {
                  diaryId: observation.diary,
                })
              }
              hitSlop={{ top: 8, bottom: 8 }}
            >
              <Ionicons
                name="book-outline"
                size={18}
                color={Colors.textSecondary}
                style={{ marginRight: 10 }}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.diaryLabelRow}>
                  <Text style={styles.diaryLabel}>{t("diary_entry")}</Text>
                  <Text style={styles.diaryTitle}>
                    {formatDate(observation.date_time)}
                  </Text>
                </View>

                {observation.diary_data?.name && (
                  <Text style={styles.diaryDescription}>
                    {observation.diary_data?.name}
                  </Text>
                )}
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={Colors.textSecondary}
              />
            </Pressable>
          )}
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
        </Section>
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
    capsule: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      fontSize: 14,
      gap: 4,
    },
    capsuleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingBottom: 8,
      gap: 8,
    },

    capsuleText: {
      fontSize: 12,
      fontWeight: "500",
      color: Colors.textMain,
    },
    diaryBlock: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    diaryLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 2,
      gap: 8,
    },
    diaryLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    diaryTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: Colors.textMain,
    },
    diaryDescription: {
      fontSize: 12,
      fontWeight: "600",
      color: Colors.textSecondary,
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
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginHorizontal: 4,
    },
    iconButton: {
      marginRight: 0,
    },

    placeRow: {
      marginTop: 12,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
    },
    placeName: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
    },
    placeTerritory: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginTop: 2,
    },
    mapWrapper: {
      marginHorizontal: -16,
      marginBottom: -16,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      overflow: "hidden",
    },
    tapHint: {
      fontSize: 11,
      color: Colors.textSecondary,
      marginTop: 3,
    },
  });
