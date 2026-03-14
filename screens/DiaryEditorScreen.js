import { useState, useCallback, useLayoutEffect } from "react";
import { StyleSheet, Platform, KeyboardAvoidingView, View } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import IconButton from "../components/ui/IconButton";
import DiaryForm from "../components/Diary/DiaryForm";
import { useCreateDiary } from "../hooks/Diary/useCreateDiary";
import { useUpdateItem } from "../hooks/useItem";
import { showError } from "../services/api";
import { useProfile } from "../store/profile-context";
import { getSession, setSession } from "../util/sessionStore";
import { setNavigationCallback } from "../util/navigationCallbacks";

const FORM_FIELDS = ["territory", "place", "date_time", "private", "name"];

const DiaryEditorScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const profileCtx = useProfile();

  const { diary, defaultTerritory } = route.params || {};
  const isEditMode = !!diary;

  const diaryWithParsedDate = diary
    ? {
        ...diary,
        date_time: diary.date_time ? new Date(diary.date_time) : undefined,
      }
    : undefined;

  const createDiaryMutation = useCreateDiary();
  const updateDiaryMutation = useUpdateItem(diaryWithParsedDate?.id, "Diary");

  const [territoryValue, setTerritoryValue] = useState(
    () => diaryWithParsedDate?.territory ?? defaultTerritory ?? "",
  );

  const [formData, setFormData] = useState(() => {
    const initialDate =
      diaryWithParsedDate?.date_time ??
      getSession("lastDate") ??
      new Date();

    return {
      territory: territoryValue,
      place: diaryWithParsedDate?.place ?? null,
      date_time: initialDate,
      private: diaryWithParsedDate?.private ?? profileCtx.profile?.private_diary,
      name: diaryWithParsedDate?.name ?? null,
    };
  });

  const [placeValue, setPlaceValue] = useState(formData.place);
  const [errors, setErrors] = useState({});
  const [placeData, setPlaceData] = useState(diaryWithParsedDate?.place_data ?? null);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!territoryValue) newErrors.territory = t("territory_required");
    if (!formData.date_time) newErrors.date_time = t("date_required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [territoryValue, formData.date_time, t]);

  const extractApiError = (e) => ({
    title: isEditMode ? t("update_failed") : t("create_failed"),
    message:
      Object.values(e?.response?.data).flat().join("\n") ||
      (isEditMode ? t("could_not_update_diary") : t("could_not_create_diary")),
  });

  const handleMutateError = (e) => {
    const data = e?.response?.data;
    if (!data) {
      showError(e, extractApiError);
      return;
    }
    const errorField = FORM_FIELDS.find((field) => data?.[field]);
    errorField
      ? setErrors((prev) => ({ ...prev, [errorField]: data[errorField] }))
      : showError(e, extractApiError);
  };

  const handleSaveDiary = useCallback(() => {
    if (!validateForm()) return;
    const diaryData = {
      ...formData,
      territory: territoryValue,
      place: placeValue,
    };

    if (isEditMode) {
      updateDiaryMutation.mutate(diaryData, {
        onSuccess: () => navigation.goBack(),
        onError: handleMutateError,
      });
    } else {
      createDiaryMutation.mutate(diaryData, {
        onSuccess: (res) => {
          setSession("lastDate", diaryData.date_time);
          requestAnimationFrame(() =>
            navigation.replace("DiaryDetail", {
              diaryId: res.data.id,
            }),
          );
        },
        onError: handleMutateError,
      });
    }
  }, [formData, territoryValue, placeValue, isEditMode]);

  const handleAddNewPlace = useCallback(() => {
    setNavigationCallback("onPlaceCreated", (newPlaceId, newPlaceTerritory) => {
      setPlaceValue(newPlaceId);

      if (newPlaceTerritory && newPlaceTerritory !== territoryValue) {
        setTerritoryValue(newPlaceTerritory);
        setFormData((prev) => ({
          ...prev,
          place: newPlaceId,
          territory: newPlaceTerritory,
        }));
        Toast.show({
          type: "info",
          text1: t("country_changed"),
          text2: t("country_changed_hint"),
        });
      } else {
        setFormData((prev) => ({ ...prev, place: newPlaceId }));
      }
    });
    navigation.navigate("PlaceEditor", { returnToScreen: "DiaryEditor" });
  }, [navigation, territoryValue]);

  const headerRight = useCallback(
    () => (
      <View style={styles.headerButtons}>
        <IconButton
          icon="checkmark"
          onPress={handleSaveDiary}
          style={styles.saveButton}
          size={28}
          disabled={
            isEditMode
              ? updateDiaryMutation.isPending
              : createDiaryMutation.isPending
          }
          color={Colors.buttonBrightColor}
        />
      </View>
    ),
    [
      handleSaveDiary,
      isEditMode,
      createDiaryMutation.isPending,
      updateDiaryMutation.isPending,
    ],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditMode ? t("edit_diary") : t("new_diary"),
      headerRight,
    });
  }, [navigation, headerRight, isEditMode]);

  if (
    isEditMode ? updateDiaryMutation.isPending : createDiaryMutation.isPending
  ) {
    return <LoadingOverlay />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <DiaryForm
        formData={formData}
        setFormData={setFormData}
        errors={errors}
        setErrors={setErrors}
        territoryValue={territoryValue}
        setTerritoryValue={setTerritoryValue}
        placeValue={placeValue}
        setPlaceValue={setPlaceValue}
        placeData={placeData}
        setPlaceData={setPlaceData}
        onAddNewPlace={handleAddNewPlace}
        isEditMode={isEditMode}
      />
    </KeyboardAvoidingView>
  );
};

export default DiaryEditorScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundMain },
    headerButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginHorizontal: 4,
    },
    saveButton: {
      backgroundColor: Colors.buttonBrightBg,
      borderRadius: 20,
      marginRight: 0,
    },
  });
