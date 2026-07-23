import { useLayoutEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  Platform,
  Dimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../store/theme-context";
import { formatDateLong } from "../util/helpers";
import { Config } from "../constants/config";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { useItem } from "../hooks/useItem";
import { BirdSVG } from "../components/ui/Svgs";
import { formatTimeString } from "../util/timeHelpers";
import { isoToFlagEmoji, buildShareUrl, speciesDetails } from "../util/helpers";
import Section from "../components/ui/Section";
import ProfileAvatar from "../components/Profile/ProfileAvatar";
import { useProfileDisplay } from "../hooks/Profile/useProfileDisplay";
import IconsHeader from "../components/ui/IconsHeader";
import Layout from "../components/ui/Layout";
import { AppStackNavigationProp, AppStackRouteProp } from "../types";
import MapL from "../components/Map/MapL";

const CommunityDetailScreen = () => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"ObservationDetail">>();
  const { observationId } = route.params;
  const type = "Community";

  // todo? if observation.is_owner navigate to observationDetail - no observation object

  const {
    data: observation,
    isLoading,
    isError,
    error,
    isRefetching,
    refetch,
  } = useItem(observationId, type);

  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);

  const { fullName } = useProfileDisplay({
    firstName: observation?.owner?.first_name,
    lastName: observation?.owner?.last_name,
    username: observation?.owner?.username,
  });

  const handleAddObservation = () => {
    navigation.navigate("ObservationEditor", {
      defaultTerritory: observation.territory ?? null,
      defaultSpecies: observation?.species_data.id,
      returnMode: "back",
    });
  };
  const mapHeight = Dimensions.get("window").height - 460;

  const handleShare = useCallback(async () => {
    const url = buildShareUrl(`my/community/${observationId}/`);

    await Share.share(Platform.OS === "ios" ? { url } : { message: url });
  }, [observation, observationId]);

  useLayoutEffect(() => {
    if (!observation) return;
    navigation.setOptions({
      headerRight: () => <IconsHeader onSharePress={handleShare} />,
    });
  }, [navigation, handleShare, observation]);

  // TanStack sets isError on *any* failed fetch, background ones included,
  // and does not clear `data` when that happens — so isError alone doesn't
  // mean "nothing to show" (e.g. offline with a cached copy already loaded).
  if (isError && !observation) {
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

  const bottomEl = (
    <FlatButtonBottom
      textColor={Colors.main100}
      onPress={handleAddObservation}
      icon="binoculars-outline"
    >
      {t("i_saw_this_too")}
    </FlatButtonBottom>
  );

  return (
    <Layout
      style={{ padding: 12 }}
      bottom={bottomEl}
      withScroll={true}
      onRefresh={refetch}
      isRefreshing={isRefetching}
    >
      <Section title={formatDateLong(observation.date_time)}>
        <Pressable
          style={styles.header}
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
              <Text style={styles.authorLabel}>{t("observation_author")}</Text>
              <View style={styles.authorRow}>
                <ProfileAvatar
                  avatar={observation?.owner?.avatar}
                  firstName={observation?.owner?.first_name}
                  lastName={observation?.owner?.last_name}
                  username={observation?.owner?.username}
                  size={22}
                />
                <Text style={styles.sourceName}>{fullName}</Text>
                {observation?.external_username && (
                  <>
                    <Text style={styles.sourceName}>·</Text>
                    <Text style={styles.authorName}>
                      {observation?.external_username}
                    </Text>
                  </>
                )}
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

        <View style={styles.placeRow}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.placeTerritory} numberOfLines={1}>
                {isoToFlagEmoji(observation?.territory_data?.code)}{" "}
                {observation?.territory_data?.name}
              </Text>

              {(observation.is_owner || observation.location_private) && (
                <Text style={styles.placeName} numberOfLines={2}>
                  {observation?.place_data?.name
                    ? observation.is_owner
                      ? observation.place_data.name
                      : t("approximate_area")
                    : t("location_not_specified")}
                </Text>
              )}
            </View>
          </View>
        </View>

        {observation?.place_data?.location?.coordinates && (
          <View style={styles.mapWrapper}>
            <MapL
              currentCoords={
                observation.place_data.location.type === "Polygon"
                  ? observation.place_data.location.center
                  : observation.place_data.location.coordinates
              }
              currentZoom={
                observation.place_data.location.type === "Polygon" ? 10 : 13
              }
              mapHeight={mapHeight}
              showCoords={true}
              polygon={
                observation.place_data.location.type === "Polygon"
                  ? observation.place_data.location
                  : null
              }
            />
          </View>
        )}
      </Section>
    </Layout>
  );
};

export default CommunityDetailScreen;

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
      marginBottom: 2,
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
    locationPrivacy: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    sourceName: {
      fontSize: 14,
      color: Colors.textMain,
    },
  });
