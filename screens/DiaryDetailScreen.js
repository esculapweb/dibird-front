import { useCallback } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../store/theme-context";
import { formatDate } from "../util/helpers";

import IconButton from "../components/ui/IconButton";
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

  const handleAdd = useCallback(async () => {
    if (!diary) return;
    navigation.navigate("ObservationEditor", {
      diaryId: diary.id,
      territoryValue: diary.territory,
    });
  }, [navigation, diary]);

  const noItems = {
    icon: "binoculars-outline",
    message: t("no_observations_yet"),
    actions: [{ label: t("add_first_observation"), onPress: handleAdd }],
  };

  const renderItem = ({ item, index }) => (
    <DiaryObservationCard item={item} index={index} />
  );

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
      <IconButton
        icon="create-outline"
        onPress={() =>
          navigation.navigate("DiaryEditor", {
            diary: {
              ...diary,
              date_time:
                diary.date_time instanceof Date
                  ? diary.date_time.toISOString()
                  : diary.date_time,
            },
          })
        }
        style={styles.iconButton}
        size={24}
        disabled={!diary || updateMutation.isPending}
        tintColor={Colors.textMain}
      />
    ),
    [diary, updateMutation.isPending],
  );

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

  const handlePlaceNavigate = () => {
    if (!diary.place) return;
    navigation.navigate("PlaceDetail", {
      placeId: diary.place,
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        route={route}
        navigation={navigation}
        fetchFunction={fetchDiaryObservations}
        extraFilters={{ diary: diaryId, territory: diary.territory }}
        allowedFilters={["species"]}
        noSaveFilters={["species"]}
        errorTitle={t("observations_unavailable")}
        onAdd={handleAdd}
        renderItem={renderItem}
        noItems={noItems}
        title={name}
        headerRightExtra={headerRight}
        fabOffset={70}
        listHeader={
          <Section
            title={t("diary")}
            hintBlock={<PrivacyToggle value={diary.private} diary={true} />}
            collapsible={true}
          >
            <PlacePreviewRow
              placeData={diary?.place_data}
              territoryData={diary.territory_data}
              onPress={handlePlaceNavigate}
            />
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
          </Section>
        }
      />

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
      marginTop: 12,
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
