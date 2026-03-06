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
import {
  isoToFlagEmoji,
  formatDate,
  formatDateTime,
  formatDateLong,
} from "../util/helpers";

import { Config } from "../constants/config";
import IconButton from "../components/ui/IconButton";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ErrorOverlay from "../components/Error/ErrorOverlay";
import Map from "../components/Map/Map";
import { useItem, useUpdateItem, useDeleteItem } from "../hooks/useItem";
import { showError } from "../services/api";

const DiaryDetailScreen = ({ route, navigation }) => {
  const { diaryId } = route.params;
  const type = "Diary";

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

  const handleDelete = useCallback(() => {
    if (!diary) return;

    Alert.alert(
      t("delete_title"),
      t("delete_diary_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate(diaryId, {
              onSuccess: () => navigation.goBack(),
              onError: (e) => showError(e),
            }),
        },
      ],
      { cancelable: true },
    );
  }, [diary, diaryId]);

  const headerRight = useCallback(
    () => (
      <View style={styles.headerButtons}>
        <IconButton
          icon="create-outline"
          onPress={() => navigation.navigate("DiaryEditor", { diary })}
          style={styles.iconButton}
          size={24}
          disabled={!diary || updateMutation.isPending}
          color={Colors.textSecondary}
        />
      </View>
    ),
    [diary, updateMutation.isPending],
  );

  useLayoutEffect(() => {
    if (!diary) return;

    navigation.setOptions({
      title: "",
      headerRight,
    });
  }, [navigation, headerRight, diary]);

  if (isError) {
    return (
      <ErrorOverlay
        title={t("diaries_unavailable")}
        message={error.message}
        onPress={refetch}
        logo
      />
    );
  }

  if (isLoading || !diary) return <LoadingOverlay />;

  const name = formatDate(diary.date_time);
  const flag = isoToFlagEmoji(diary.territory_data.code);
  const territory = diary.territory_data.name;

  const handlePlaceNavigate = () => {
    if (!diary.place) return;
    navigation.navigate("PlaceDetail", {
      placeId: diary.place,
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* HEADER */}
        <View style={[styles.section, styles.header]}>
          <View style={styles.imageWrapper}>
            {diary?.place_data?.location?.coordinates?.length === 2 && (
              <View style={{ borderRadius: 12, overflow: "hidden" }}>
                <Map
                  currentCoords={diary.place_data.location.coordinates}
                  mapHeight={120}
                  currentZoom={10}
                  showCoords={false}
                />
              </View>
            )}

            {/* <View style={styles.imagePlaceholder}>
              <BirdSVG size={40} color={Colors.textSecondary} />
              
            </View>*/}
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.title}>{name}</Text>
            </View>

            {diary.private ? (
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

        <View style={styles.section}>
          <Pressable style={styles.placeWrap} onPress={handlePlaceNavigate}>
            {diary?.place_data ? (
              <Text style={styles.placeName}>{diary.place_data.name}</Text>
            ) : (
              <Text style={styles.placeName}>
                {t("location_not_specified")}
              </Text>
            )}
            <Text style={styles.placeTerritory}>
              {flag} {territory}
            </Text>
            {/* {diary?.place_data?.location?.coordinates?.length === 2 && (
              <View style={{ borderRadius: 12, overflow: "hidden" }}>
                <Map
                  currentCoords={diary.place_data.location.coordinates}
                  mapHeight={300}
                  showCoords={true}
                />
              </View>
            )} */}
          </Pressable>

          {/* NOTES */}
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

export default DiaryDetailScreen;

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
