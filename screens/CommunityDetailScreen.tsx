import { useLayoutEffect, useCallback, useEffect, useMemo } from "react";
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
import { isoToFlagEmoji, buildShareUrl } from "../util/helpers";
import { useOpenSpecies } from "../hooks/useOpenSpecies";
import Section from "../components/ui/Section";
import ProfileAvatar from "../components/Profile/ProfileAvatar";
import { useProfileDisplay } from "../hooks/Profile/useProfileDisplay";
import IconsHeader from "../components/ui/IconsHeader";
import ObservationPhotos from "../components/Observation/ObservationPhotos";
import { track } from "../services/analytics";
import Layout from "../components/ui/Layout";
import { overflowButton } from "../components/ui/overflowMenu";
import { useModeration } from "../hooks/useModeration";
import {
  AppStackNavigationProp,
  AppStackRouteProp,
  IconButtonConfig,
  ObservationPhoto,
} from "../types";
import MapL from "../components/Map/MapL";

const CommunityDetailScreen = () => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const openSpecies = useOpenSpecies();
  const route = useRoute<AppStackRouteProp<"ObservationDetail">>();
  const { observationId } = route.params;
  const type = "Community";

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
  const { report, block } = useModeration();

  // Own record on the feed's screen: the share button on ObservationDetail
  // builds a community URL (`my/community/<id>/`), and the feed's retrieve
  // serves your own observations too — so opening your own shared link lands
  // here, on a card built for someone else's record: no notes, no privacy
  // toggle, no editing, and an "I saw this too" button that would duplicate
  // what you are looking at. The list itself never gets here (it excludes own
  // records server-side, and DiaryObservationCard routes by ownership).
  //
  // replace, not navigate: this screen has nothing to come back to. The id is
  // enough — `initialObservation` is optional on ObservationDetail, which
  // loads the record itself.
  useEffect(() => {
    if (observation?.is_owner) {
      navigation.replace("ObservationDetail", { observationId });
    }
  }, [observation?.is_owner, navigation, observationId]);

  const { fullName } = useProfileDisplay({
    firstName: observation?.owner?.first_name,
    lastName: observation?.owner?.last_name,
    username: observation?.owner?.username,
  });

  const handleAddObservation = () => {
    navigation.navigate("ObservationEditor", {
      // undefined, not null — see ObservationsScreen: a community observation
      // without a country shouldn't force the user's own copy to open empty.
      defaultTerritory: observation.territory ?? undefined,
      defaultSpecies: observation?.species_data.id,
      returnMode: "back",
    });
  };
  const mapHeight = Dimensions.get("window").height - 460;

  const handleShare = useCallback(async () => {
    const url = buildShareUrl(`my/community/${observationId}/`);

    track("share_tapped", { type: "community_observation" });
    await Share.share(Platform.OS === "ios" ? { url } : { message: url });
  }, [observation, observationId]);

  // The server stops serving a record its viewer reported, so staying here
  // would mean sitting on a card the next refetch turns into a 404.
  const handleReport = useCallback(
    () =>
      report(
        { observation: observationId },
        { onDone: () => navigation.goBack() },
      ),
    [report, observationId, navigation],
  );

  // A photo is reported without leaving: the rest of the record is not what
  // the complaint is about, and the invalidated query drops the photo from
  // the strip by itself.
  const handleReportPhoto = useCallback(
    (photo: ObservationPhoto) => report({ photo: photo.id }),
    [report],
  );

  // Blocking sits next to reporting rather than only on the author's profile:
  // this is where a stranger's content is actually seen, and making the reader
  // find the profile screen first is exactly the friction Apple's UGC rule is
  // about.
  const headerRightEnd = useMemo<IconButtonConfig[]>(
    () => [
      overflowButton([
        {
          label: t("share"),
          icon: "share-social-outline",
          onPress: () => {
            void handleShare();
          },
        },
        {
          label: t("report_observation"),
          icon: "flag-outline",
          opensAnotherSheet: true,
          testID: "report-observation-button",
          onPress: handleReport,
        },
        {
          condition: !!observation?.owner?.id,
          label: t("block_author"),
          icon: "ban-outline",
          danger: true,
          opensAnotherSheet: true,
          testID: "block-author-button",
          onPress: () =>
            block(observation.owner.id, { onDone: () => navigation.goBack() }),
        },
      ]),
    ],
    [t, handleShare, handleReport, block, observation, navigation],
  );

  useLayoutEffect(() => {
    if (!observation) return;
    navigation.setOptions({
      headerRight: () => <IconsHeader headerRightEnd={headerRightEnd} />,
    });
  }, [navigation, headerRightEnd, observation]);

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

  // is_owner holds the screen on the overlay rather than rendering a card the
  // effect above is about to replace anyway.
  if (isLoading || !observation || observation.is_owner)
    return <LoadingOverlay />;

  const name =
    observation.species_data.name_lang || observation.species_data.name;
  const latin = observation.species_data.name;
  // Missing on a record created offline and on a copy cached under another
  // language, and the segment is what the species page is keyed by. The header
  // stops advertising a link it cannot follow rather than answering a tap with
  // nothing.
  const speciesSegment = observation.species_data.segment;

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
          disabled={!speciesSegment}
          onPress={() => openSpecies(speciesSegment, "community_observation")}
        >
          {({ pressed }) => (
            <>
              <View style={styles.imageWrapper}>
                {observation?.species_data?.thumb ? (
                  <>
                    <Image
                      source={{
                        uri: `${Config.mediaUrl}/${observation.species_data.thumb}`,
                      }}
                      style={styles.image}
                      contentFit="cover"
                      cachePolicy="disk"
                    />
                    {/* Same shape and same subject as the observation's own
                        photos in the strip below, so this reference shot of
                        the species has to say which of the two it is. */}
                    <View style={styles.speciesPhotoBadge}>
                      <Text
                        style={styles.speciesPhotoBadgeText}
                        numberOfLines={1}
                      >
                        {t("species_photo_badge")}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <BirdSVG size={40} color={Colors.textSecondary} />
                  </View>
                )}
                {pressed && !!speciesSegment && (
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
                    {!!speciesSegment && (
                      <>
                        <Text style={styles.aboutDot}>·</Text>
                        <Text style={styles.aboutLink}>
                          {t("about_species")}
                        </Text>
                      </>
                    )}
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

        {/* Someone else's photos come down with the feed row itself (see
            Observation2Serializer), so the card shows them the same way the
            own observation does. */}
        {!!observation.photos?.length && (
          <View style={styles.photosRow}>
            <ObservationPhotos
              photos={observation.photos}
              onReport={handleReportPhoto}
            />
          </View>
        )}

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

              {/* Own records never render here any more — they are replaced
                  with ObservationDetail above — so what is left is the
                  stranger's half of the rule. */}
              {observation.location_private && (
                <Text style={styles.placeName} numberOfLines={2}>
                  {/* Whether the name is visible is the server's call:
                      someone else's place comes back with `name: null`, a
                      public eBird hotspot keeps its own. The presence of a
                      place is `place_data` itself. */}
                  {observation?.place_data
                    ? (observation.place_data.name ?? t("approximate_area"))
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
    speciesPhotoBadge: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      paddingVertical: 3,
      backgroundColor: "rgba(0, 0, 0, 0.45)",
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
    },
    speciesPhotoBadgeText: {
      fontSize: 9,
      fontWeight: "600",
      color: "#fff",
      textTransform: "uppercase",
      letterSpacing: 0.4,
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
    photosRow: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
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
