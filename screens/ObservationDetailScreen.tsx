import { useLayoutEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../store/theme-context";
import { formatDate, formatDateTime, formatDateLong } from "../util/helpers";
import { Config } from "../constants/config";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { useItem, useUpdateItem, useDeleteItem } from "../hooks/useItem";
import { showError } from "../services/api";
import { BirdSVG } from "../components/ui/Svgs";
import { formatTimeString } from "../util/timeHelpers";
import { isoToFlagEmoji, buildShareUrl, speciesDetails } from "../util/helpers";
import Section from "../components/ui/Section";
import PrivacyToggle from "../components/ui/PrivacyToggle";
import Map from "../components/Map/Map";
import ProfileAvatar from "../components/Profile/ProfileAvatar";
import { useProfileDisplay } from "../hooks/Profile/useProfileDisplay";
import IconsHeader from "../components/ui/IconsHeader";
import Layout from "../components/ui/Layout";
import { AppStackNavigationProp, AppStackRouteProp } from "../types";
import { BottomSheet } from "../services/bottomSheet";

const ObservationDetailScreen = () => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"ObservationDetail">>();
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

  const { fullName } = useProfileDisplay({
    firstName: observation?.owner?.first_name,
    lastName: observation?.owner?.last_name,
    username: observation?.owner?.username,
  });

  const handleDelete = useCallback(() => {
    if (!observation) return;

    BottomSheet.show({
      title: t("delete_title"),
      description: t("delete_observation_message"),
      confirmText: t("delete"),
      cancelText: t("cancel"),
      danger: true,
      onConfirm: () =>
        deleteMutation.mutate(observationId, {
          onSuccess: () => navigation.goBack(),
          onError: (e) => showError(e),
        }),
    });
  }, [observation, observationId]);

  const headerRightBeginning = useMemo(
    () => [
      {
        condition: observation?.is_owner,
        onPress: () =>
          navigation.navigate("ObservationEditor", {
            observation: {
              ...observation,
              date_time:
                observation.date_time instanceof Date
                  ? observation.date_time.toISOString()
                  : observation.date_time,
            },
            ...(observation.diary && {
              diaryId: observation.diary,
              territoryValue: observation.territory,
            }),
          }),
        icon: "create-outline" as const,
        disabled: !observation || updateMutation.isPending,
      },
    ],
    [observation, updateMutation.isPending, navigation],
  );

  const handleShare = useCallback(async () => {
    if (observation?.private) {
      Toast.show({
        type: "info",
        text1: t("observation_private"),
        text2: t("observation_private_share_hint"),
      });
      return;
    }

    const url = buildShareUrl(`my/observation/${observationId}/`);

    await Share.share(Platform.OS === "ios" ? { url } : { message: url });
  }, [observation, observationId]);

  useLayoutEffect(() => {
    if (!observation) return;
    navigation.setOptions({
      headerRight: () => (
        <IconsHeader
          headerRightBeginning={headerRightBeginning}
          onSharePress={handleShare}
        />
      ),
    });
  }, [navigation, headerRightBeginning, handleShare, observation]);

  if (isError) {
    return (
      <ErrorOverlay
        title={t("observations_unavailable")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );
  }

  if (isLoading || !observation) return <LoadingOverlay />;

  const name =
    observation.species_data.name_lang || observation.species_data.name;
  const latin = observation.species_data.name;

  const bottomEl = observation.is_owner && (
    <FlatButtonBottom
      textColor={Colors.error600}
      onPress={handleDelete}
      icon="trash-outline"
      loading={deleteMutation.isPending}
    >
      {t("delete_observation")}
    </FlatButtonBottom>
  );

  return (
    <Layout style={{ padding: 12 }} bottom={bottomEl} withScroll={true}>
      <Section
        title={formatDateLong(observation.date_time)}
        hintBlock={
          observation.is_owner && <PrivacyToggle value={observation.private} />
        }
      >
        <Pressable
          style={[styles.header, observation.is_owner && { marginBottom: 8 }]}
          onPress={() => speciesDetails(observation?.species_data?.segment)}
        >
          {({ pressed }) => (
            <>
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
                {pressed && (
                  <View style={styles.imageOverlay}>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ marginBottom: 6 }}>
                  <Text style={styles.title}>{name}</Text>
                  <View style={styles.subRow}>
                    <Text style={styles.latin}>{latin}</Text>
                    <Text style={styles.aboutDot}>·</Text>
                    <Text style={styles.aboutLink}>{t("about_species")}</Text>
                  </View>

                  {observation.time && (
                    <View style={styles.capsule}>
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={Colors.textSecondary}
                      />
                      <Text style={styles.capsuleText}>
                        {formatTimeString(observation.time)}
                      </Text>
                    </View>
                  )}

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
            </>
          )}
        </Pressable>

        {!observation.is_owner && (
          <Pressable
            style={[styles.placeRow, { marginTop: 8 }]}
            onPress={() => {
              if (observation?.owner?.private) return;
              navigation.navigate("UserStat", {
                profileId: observation?.owner?.id,
              });
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.authorLabel}>
                  {t("observation_author")}
                </Text>
                <View style={styles.authorRow}>
                  <ProfileAvatar
                    avatar={observation?.owner?.avatar}
                    firstName={observation?.owner?.first_name}
                    lastName={observation?.owner?.last_name}
                    username={observation?.owner?.username}
                    size={22}
                  />
                  <Text style={styles.authorName}>{fullName}</Text>
                </View>
              </View>
              {!observation?.owner?.private && (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.textSecondary}
                />
              )}
            </View>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.placeRow,
            pressed && observation.is_owner && { opacity: 0.6 },
          ]}
          onPress={() =>
            observation?.place_data?.id &&
            observation.is_owner &&
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
            {observation?.place_data?.id && observation.is_owner && (
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
              currentCoords={
                observation.place_data.location.type === "Polygon"
                  ? observation.place_data.location.center
                  : observation.place_data.location.coordinates
              }
              currentZoom={
                observation.place_data.location.type === "Polygon" ? 10 : 13
              }
              mapHeight={250}
              showCoords={observation.place_data.location.type === "Point"}
              polygon={
                observation.place_data.location.type === "Polygon"
                  ? observation.place_data.location
                  : null
              }
              approximateArea={!observation.is_owner}
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

        {observation?.diary_data && observation.is_owner && (
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
          style={
            (observation.notes ||
              observation?.diary_data ||
              observation?.place_data) &&
            styles.metaBorder
          }
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
    </Layout>
  );
};

export default ObservationDetailScreen;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
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
    imageOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 12,
      backgroundColor: "rgba(15, 110, 86, 0.55)",
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
    placeRow: {
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
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
    },
    mapWrapper: {
      marginHorizontal: -16,
      marginBottom: -16,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      overflow: "hidden",
    },
    authorLabel: {
      fontSize: 11,
      color: Colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    authorName: {
      fontSize: 14,
      fontWeight: "600",
      color: Colors.textMain,
    },
    subRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      marginTop: 1,
      minWidth: 0,
    },
    aboutDot: {
      fontSize: 12,
      color: Colors.textSecondary,
      flexShrink: 0,
    },
    aboutLink: {
      fontSize: 12,
      color: Colors.main100,
      flexShrink: 0,
    },
  });
