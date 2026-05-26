import { useState, useCallback, useMemo } from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";

import { useTheme, ThemeColors } from "../store/theme-context";
import { formatDateLong, buildShareUrl, isoToFlagEmoji } from "../util/helpers";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import { useItem, useUpdateItem, useDeleteItem } from "../hooks/useItem";
import { showError } from "../services/api";
import PlacePreviewRow from "../components/Place/PlacePreviewRow";
import Section from "../components/ui/Section";
import PrivacyToggle from "../components/ui/PrivacyToggle";
import ListScreen from "./ListScreen";
import { fetchDiaryObservations } from "../util/fetches";
import DiaryObservationCard from "../components/Diary/DiaryObservationCard";
import ProfileAvatar from "../components/Profile/ProfileAvatar";
import { useProfileDisplay } from "../hooks/Profile/useProfileDisplay";
import Map from "../components/Map/Map";
import { BottomSheet } from "../services/bottomSheet";

import {
  AppStackNavigationProp,
  AppStackRouteProp,
  DiaryObservationItem,
  Filters,
} from "../types";

const DiaryDetailScreen = () => {
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"DiaryDetail">>();
  const { diaryId } = route.params;
  const type = "Diary";

  const [currentFilters, setCurrentFilters] = useState<Filters | null>(null);
  const [currentSort, setCurrentSort] = useState<string | null>(null);

  const {
    data: diary,
    isLoading,
    isError,
    error,
    refetch,
  } = useItem(diaryId, type);

  const updateMutation = useUpdateItem(diaryId, type);
  const deleteMutation = useDeleteItem(type);

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
      <Section
        title={formatDateLong(diary.date_time)}
        hintBlock={
          diary.is_owner && (
            <PrivacyToggle value={diary.private} gender="male" />
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
          <PlacePreviewRow
            placeData={diary?.place_data}
            territoryData={diary.territory_data}
          />
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
                <Text style={styles.placeName} numberOfLines={2}>
                  {diary?.place_data?.name || t("location_not_specified")}
                </Text>
                <Text style={styles.placeTerritory} numberOfLines={1}>
                  {isoToFlagEmoji(diary?.territory_data?.code)}{" "}
                  {diary?.territory_data?.name}
                </Text>
              </View>
            </View>
          </View>
        )}

        {!diary.is_owner && diary?.place_data?.location?.coordinates && (
          <View style={styles.mapWrapper}>
            <Map
              currentCoords={
                diary.place_data.location.type === "Polygon"
                  ? diary.place_data.location.center
                  : diary.place_data.location.coordinates
              }
              currentZoom={9}
              mapHeight={180}
              showCoords={diary.place_data.location.type === "Point"}
              polygon={
                diary.place_data.location.type === "Polygon"
                  ? diary.place_data.location
                  : null
              }
              approximateArea={!diary.is_owner}
            />
          </View>
        )}
      </Section>
    ),
    [diary],
  );

  const handleAdd = useCallback(async () => {
    if (!diary) return;
    navigation.navigate("ObservationEditor", {
      diaryId: diary.id,
      territoryValue: diary.territory,
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
  }) => <DiaryObservationCard item={item} index={index} />;

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
          onError: (e) => showError(e),
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
      },
    ],
    [diary, handleOpenEdit, updateMutation.isPending],
  );

  if (isError) {
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
      fabBottomOffset={90}
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
      marginTop: 2,
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
  });
