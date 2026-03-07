import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
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
import { fetchMapPreview } from "../util/fetches";
import Section from "../components/ui/Section";
import PlacePreviewRow from "../components/Place/PlacePreviewRow";
import PrivacyToggle from "../components/ui/PrivacyToggle";

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

  const [previewUri, setPreviewUri] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!observation) return;

    if (observation?.place_data?.preview) {
      setPreviewUri(`${Config.mediaUrl}/${observation.place_data.preview}`);
    } else if (observation?.place) {
      setPreviewLoading(true);
      fetchMapPreview(observation.place)
        .then((data) => {
          setPreviewUri(`${Config.mediaUrl}/${data.preview}`);
        })
        .catch((e) => console.warn("map preview error:", e))
        .finally(() => setPreviewLoading(false));
    }
  }, [observation?.place, observation?.place_data?.preview]);

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
            navigation.navigate("ObservationEditor", { observation })
          }
          style={styles.iconButton}
          size={24}
          disabled={!observation || updateMutation.isPending}
          color={Colors.textSecondary}
        />
      </View>
    ),
    [observation, updateMutation.isPending],
  );

  useLayoutEffect(() => {
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

  const handlePlaceNavigate = () => {
    if (!observation.place) return;
    navigation.navigate("PlaceDetail", {
      placeId: observation.place,
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* HEADER */}
        <Section title={t("section_main")}>
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
        </Section>
        {/* CAPSULES */}

        <Section title={t("section_where")}>
          <PlacePreviewRow
            observation={observation}
            onPress={handlePlaceNavigate}
            isLoading={previewLoading}
            previewUri={previewUri}
            style={{ marginBottom: 12 }}
          />
        </Section>
        <Section title={t("section_details")}>
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
        </Section>

        <Section title={t("section_privacy")}>
          <PrivacyToggle value={observation.private} />
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
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginHorizontal: 4,
    },
    iconButton: {
      marginRight: 0,
    },
  });
