import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../store/theme-context";
import { formatDateLong, buildShareUrl, isoToFlagEmoji } from "../util/helpers";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import {
  useDiaryItem,
  useUpdateDiary,
  useDeleteDiary,
} from "../hooks/Diary/useOfflineDiary";
import * as diaryRepository from "../hooks/repositories/diaryRepository";
import { runDiarySync } from "../services/sync/diarySync";
import PlacePreviewRow from "../components/Place/PlacePreviewRow";
import Section from "../components/ui/Section";
import PrivacyToggle from "../components/ui/PrivacyToggle";
import ListScreen from "./ListScreen";
import { fetchDiaryObservations } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import DiaryObservationCard from "../components/Diary/DiaryObservationCard";
import ProfileAvatar from "../components/Profile/ProfileAvatar";
import { useProfileDisplay } from "../hooks/Profile/useProfileDisplay";
import { BottomSheet } from "../services/bottomSheet";
import { useApiError } from "../hooks/useApiError";
import FailedEditBanner from "../components/Profile/FailedEditBanner";

import {
  AppStackNavigationProp,
  AppStackRouteProp,
  DiaryObservationItem,
  Filters,
} from "../types";
import MapL from "../components/Map/MapL";

const DiaryDetailScreen = () => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"DiaryDetail">>();
  const { diaryId, initialDiary } = route.params;
  const { showErrorToast } = useApiError();

  // Same defensive retry as ObservationDetailScreen: NetInfo's reconnect event
  // can be missed/racy, so opportunistically retry the queue whenever this
  // screen is focused rather than relying solely on the background listener.
  useFocusEffect(
    useCallback(() => {
      runDiarySync();
    }, []),
  );

  const [currentFilters, setCurrentFilters] = useState<Filters | null>(null);
  const [currentSort, setCurrentSort] = useState<string | null>(null);

  const {
    data: diary,
    isLoading,
    isError,
    error,
    refetch,
  } = useDiaryItem(diaryId, initialDiary);

  const updateMutation = useUpdateDiary(diaryId);
  const deleteMutation = useDeleteDiary();

  // An offline create resolves to a real server id in the background; once
  // that happens, "graduate" this screen from the temp id to the real one so
  // any further edit/delete/share call targets the right id.
  useEffect(() => {
    if (diary && diary.id !== diaryId) {
      navigation.setParams({ diaryId: diary.id });
    }
  }, [diary, diaryId, navigation]);

  const failedMutation = diary?._syncError
    ? diaryRepository.getFailedMutationFor(diaryId)
    : null;

  const handleRetrySync = useCallback(async () => {
    if (!failedMutation) return;
    diaryRepository.retryMutation(failedMutation.id, diaryId);
    await runDiarySync();
    await refetch();
  }, [failedMutation, diaryId, refetch]);

  const handleDiscardSync = useCallback(() => {
    if (!failedMutation) return;
    diaryRepository.discardMutation(failedMutation.id, diaryId);
    refetch();
  }, [failedMutation, diaryId, refetch]);

  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);

  const { fullName } = useProfileDisplay({
    firstName: diary?.owner?.first_name,
    lastName: diary?.owner?.last_name,
    username: diary?.owner?.username,
  });

  const listHeader = useCallback(
    () => (
      <>
        {diary._syncError && failedMutation && (
          <FailedEditBanner
            failedEdit={{ message: diary._syncError, createdAt: Date.now() }}
            onRetry={handleRetrySync}
            onDiscard={handleDiscardSync}
          />
        )}
        <Section
          title={formatDateLong(diary.date_time)}
          hintBlock={
            diary.is_owner && (
              <PrivacyToggle value={diary.private} descriptionType="male" />
            )
          }
          collapsible={true}
        >
          {diary?.name && (
          <View style={styles.notesBlock}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color={Colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.notes}>{diary.name}</Text>
          </View>
        )}

        {!diary.is_owner && (
          <Pressable
            style={styles.placeRow}
            onPress={() => {
              if (diary?.owner?.private) return;
              navigation.navigate("UserStat", {
                profileId: diary?.owner?.id,
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
                <Text style={styles.authorLabel}>{t("diary_author")}</Text>
                <View style={styles.authorRow}>
                  <ProfileAvatar
                    avatar={diary?.owner?.avatar}
                    firstName={diary?.owner?.first_name}
                    lastName={diary?.owner?.last_name}
                    username={diary?.owner?.username}
                    size={22}
                  />
                  <Text style={styles.authorName}>{fullName}</Text>
                </View>
              </View>
              {!diary?.owner?.private && (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={Colors.textSecondary}
                />
              )}
            </View>
          </Pressable>
        )}

        {diary.is_owner && (
          <>
            <PlacePreviewRow
              placeData={diary?.place_data}
              territoryData={diary.territory_data}
            />
            {diary.place && !diary.private && (
              <View style={styles.locationPrivacy}>
                <PrivacyToggle
                  descriptionType="location"
                  value={diary.location_private}
                />
              </View>
            )}
          </>
        )}

        {!diary.is_owner && (
          <View
            style={[
              styles.placeRow,
              !diary?.place_data && { marginBottom: -8 },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.placeTerritory} numberOfLines={1}>
                  {isoToFlagEmoji(diary?.territory_data?.code)}{" "}
                  {diary?.territory_data?.name}
                </Text>
                {diary.is_owner ||
                  (diary.location_private && (
                    <Text style={styles.placeName} numberOfLines={2}>
                      {diary?.place_data?.name
                        ? diary.is_owner
                          ? diary.place_data.name
                          : t("approximate_area")
                        : t("location_not_specified")}
                    </Text>
                  ))}
              </View>
            </View>
          </View>
        )}

        {!diary.is_owner && diary?.place_data?.location?.coordinates && (
          <View style={styles.mapWrapper}>
            <MapL
              currentCoords={
                diary.place_data.location.type === "Polygon"
                  ? diary.place_data.location.center
                  : diary.place_data.location.coordinates
              }
              currentZoom={9}
              mapHeight={250}
              showCoords={true}
              polygon={
                diary.place_data.location.type === "Polygon"
                  ? diary.place_data.location
                  : null
              }
            />
          </View>
        )}
        </Section>
      </>
    ),
    [diary, failedMutation, handleRetrySync, handleDiscardSync],
  );

  const handleAdd = useCallback(async () => {
    if (!diary) return;
    navigation.navigate("ObservationEditor", {
      diaryId: diary.id,
      territoryValue: diary.territory,
      diaryLocationPrivate: diary.location_private,
      returnMode: "back",
    });
  }, [navigation, diary]);

  const handleShare = useCallback(async () => {
    if (diary?.private) {
      Toast.show({
        type: "info",
        text1: t("diary_private"),
        text2: t("diary_private_share_hint"),
      });
      return;
    }

    const url = buildShareUrl(
      `my/diary/${diaryId}/`,
      currentFilters,
      currentSort,
    );

    await Share.share(Platform.OS === "ios" ? { url } : { message: url });
  }, [diary, diaryId, currentFilters, currentSort]);

  const noItems = {
    icon: "binoculars-outline" as const,
    message: t("no_observations_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: DiaryObservationItem;
    index: number;
  }) => <DiaryObservationCard item={item} index={index} owner={diary.is_owner} />;

  const handleDelete = useCallback(() => {
    if (!diary) return;

    BottomSheet.show({
      title: t("delete_title"),
      description: t("delete_diary_message"),
      confirmText: t("delete"),
      cancelText: t("cancel"),
      danger: true,
      onConfirm: () =>
        deleteMutation.mutate(diaryId, {
          onSuccess: () => navigation.goBack(),
          onError: (e) =>
            showErrorToast(e, `DiaryDetailScreen:deleteDiary:${diaryId}`),
        }),
    });
  }, [diary, diaryId]);

  const handleOpenEdit = useCallback(
    () =>
      navigation.navigate("DiaryEditor", {
        diary: {
          ...diary,
          date_time:
            diary.date_time instanceof Date
              ? diary.date_time.toISOString()
              : diary.date_time,
        },
      }),
    [diary, navigation],
  );

  const headerRightBeginning = useMemo(
    () => [
      {
        condition: diary?.is_owner,
        onPress: handleOpenEdit,
        icon: "create-outline" as const,
        disabled: !diary || updateMutation.isPending,
        testID: "diary-edit-button",
      },
    ],
    [diary, handleOpenEdit, updateMutation.isPending],
  );

  // TanStack sets isError on *any* failed fetch, background ones included,
  // and does not clear `data` when that happens — so isError alone doesn't
  // mean "nothing to show" (see useDiaryItem's initialData seeding, same
  // reasoning as ObservationDetailScreen's identical guard). Only show the
  // full-screen error when there's truly nothing to render.
  if (isError && !diary) {
    return (
      <ErrorOverlay
        title={t("diaries_unavailable")}
        message={error.message}
        onPress={async () => {
          await refetch();
        }}
        logo
      />
    );
  }

  if (isLoading || !diary) return <LoadingOverlay />;

  const bottomEl = diary?.is_owner && (
    <FlatButtonBottom
      textColor={Colors.error600}
      onPress={handleDelete}
      icon="trash-outline"
      loading={deleteMutation.isPending}
      testID="diary-delete-button"
    >
      {t("delete_diary")}
    </FlatButtonBottom>
  );

  return (
    <ListScreen
      route={route}
      fetchFunction={fetchDiaryObservations}
      extraFilters={{ diary: diaryId, territory: diary.territory }}
      allowedFilters={["species"]}
      onFiltersChange={async (val) => setCurrentFilters(val)}
      onSortChange={async (val) => setCurrentSort(val)}
      errorTitle={t("observations_unavailable")}
      onAdd={diary.is_owner ? handleAdd : undefined}
      renderItem={renderItem}
      noItems={noItems}
      title={t("diary")}
      headerRightBeginning={headerRightBeginning}
      handleSharePress={handleShare}
      listHeader={listHeader}
      bottomEl={bottomEl}
      fabBottomOffset={60}
      staleTime={StaleTime.TWO_MINUTES}
    />
  );
};

export default DiaryDetailScreen;

const stylesFn = (Colors: ThemeColors) =>
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
      justifyContent: "space-between",
      marginBottom: 12,
    },
    imageWrapper: {
      width: 120,
      height: 120,
      marginRight: 16,
    },
    image: {
      width: 120,
      height: 120,
      borderRadius: 12,
      backgroundColor: Colors.imageBg,
    },
    imagePlaceholder: {
      width: 120,
      height: 120,
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
      marginBottom: 2,
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
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "center",
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
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
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
    mapWrapper: {
      marginHorizontal: -16,
      marginBottom: -16,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      overflow: "hidden",
    },
    locationPrivacy: {
      marginTop: 12,
    },
  });
