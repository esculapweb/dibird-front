import { useCallback, useLayoutEffect, useMemo } from "react";
import { Platform, KeyboardAvoidingView } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import DiaryForm from "../components/Diary/DiaryForm";
import { useCreateDiary } from "../hooks/Diary/useCreateDiary";
import { useUpdateItem } from "../hooks/useItem";
import { showError } from "../services/api";
import { useProfile } from "../store/profile-context";
import { setSession } from "../util/sessionStore";
import { setNavigationCallback } from "../util/navigationCallbacks";
import { useEditorForm } from "../hooks/useEditorForm";
import IconsHeader from "../components/ui/IconsHeader";

const FORM_FIELDS = ["territory", "place", "date_time", "private", "name"];

const DiaryEditorScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { profile } = useProfile();

  const { diary, defaultTerritory, defaultPlace } = route.params || {};
  const isEditMode = !!diary;

  const {
    itemWithParsedDate: diaryWithParsedDate,
    formData,
    setFormData,
    errors,
    setErrors,
    territoryValue,
    setTerritoryValue,
    placeValue,
    setPlaceValue,
    placeData,
    setPlaceData,
    validateForm,
  } = useEditorForm({
    item: diary,
    defaultTerritory,
    defaultPlace,
    profile,
    hasSpecies: false,
    requiredFields: ["territory", "date_time"],
  });

  const createDiaryMutation = useCreateDiary();
  const updateDiaryMutation = useUpdateItem(diaryWithParsedDate?.id, "Diary");

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
            navigation.replace("DiaryDetail", { diaryId: res.data.id }),
          );
        },
        onError: handleMutateError,
      });
    }
  }, [formData, territoryValue, placeValue, isEditMode]);

  const handleAddNewPlace = useCallback(() => {
    setNavigationCallback(
      "onPlaceCreated",
      (newPlaceId, newPlaceTerritory, newPlaceData) => {
        setPlaceValue(newPlaceId);
        setPlaceData(newPlaceData);

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
      },
    );
    navigation.navigate("PlaceEditor", { returnToScreen: "DiaryEditor" });
  }, [navigation, territoryValue]);

  const headerRightBeginning = useMemo(
    () => [
      {
        condition: !!diary,
        onPress: handleSaveDiary,
        icon: "checkmark-circle",
        size: 36,
        tintColor: Colors.seenIcon,
        disabled: isEditMode
          ? updateDiaryMutation.isPending
          : createDiaryMutation.isPending,
      },
    ],
    [
      diary,
      handleSaveDiary,
      isEditMode,
      createDiaryMutation.isPending,
      updateDiaryMutation.isPending,
      Colors.seenIcon,
    ],
  );

  const headerRight = useCallback(
    () => <IconsHeader headerRightBeginning={headerRightBeginning} />,
    [headerRightBeginning],
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
      style={{
        container: { flex: 1, backgroundColor: Colors.backgroundMain },
      }}
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
