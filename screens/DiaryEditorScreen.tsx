import {
  useCallback,
  useLayoutEffect,
  useMemo,
  Dispatch,
  SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useRoute, useNavigation } from "@react-navigation/native";

import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import DiaryForm from "../components/Diary/DiaryForm";
import { useCreateItem, useUpdateItem } from "../hooks/useItem";
import { useProfile } from "../store/profile-context";
import { setSession } from "../util/sessionStore";
import {
  setNavigationCallback,
  setTypedNavigationCallback,
} from "../util/navigationCallbacks";
import { useEditorForm } from "../hooks/useEditorForm";
import IconsHeader from "../components/ui/IconsHeader";
import Layout from "../components/ui/Layout";
import { useApiError } from "../hooks/useApiError";
import {
  AppError,
  AppStackNavigationProp,
  AppStackRouteProp,
  DiaryFormData,
  DiaryItem,
  ErrorExtractor,
  PlaceData,
} from "../types";

const FORM_FIELDS = ["territory", "place", "date_time", "private", "name"];

const DiaryEditorScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { profile } = useProfile();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"DiaryEditor">>();
  const { showErrorToast } = useApiError();

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
    item: diary ?? null,
    defaultTerritory,
    defaultPlace,
    profile,
    hasSpecies: false,
    requiredFields: ["territory", "date_time"],
  });

  const createDiaryMutation = useCreateItem<DiaryFormData, DiaryItem>("Diary");
  const updateDiaryMutation = useUpdateItem(diaryWithParsedDate?.id, "Diary");

  const extractApiError = useCallback<ErrorExtractor>(
    (err) => ({
      title: isEditMode ? t("update_failed") : t("create_failed"),
      message:
        Object.values(err?.response?.data).flat().join("\n") ||
        (isEditMode
          ? t("could_not_update_diary")
          : t("could_not_create_diary")),
    }),
    [t],
  );

  const handleMutateError = (e: AppError) => {
    const data = e?.response?.data;
    if (!data) {
      showErrorToast(e, "DiaryEditorScreen:handleMutateError", extractApiError);
      return;
    }
    const errorField = FORM_FIELDS.find((field) => data?.[field]);
    if (errorField) {
      setErrors((prev) => ({ ...prev, [errorField]: data[errorField] }));
    } else {
      showErrorToast(e, "DiaryEditorScreen:handleMutateError", extractApiError);
    }
  };

  const handleSaveDiary = useCallback(() => {
    if (!validateForm()) return;
    const diaryData: DiaryFormData = {
      territory: territoryValue,
      place: placeValue ?? null,
      date_time: formData.date_time!,
      private: formData.private ?? false,
      name: formData.name ?? "",
      location_private: formData.location_private ?? true,
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
    setNavigationCallback("onPlaceCreated", null);
    setTypedNavigationCallback<[number, number, PlaceData]>(
      "onPlaceCreated",
      (newPlaceId, newPlaceTerritory, newPlaceData) => {
        setPlaceValue(newPlaceId);
        setPlaceData({
          value: newPlaceData.id,
          label: newPlaceData.name,
          ...newPlaceData,
          preview: newPlaceData.preview ?? undefined,
          location: newPlaceData.location ?? undefined,
        });

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
        condition: true,
        onPress: handleSaveDiary,
        icon: "checkmark-circle" as const,
        size: 36,
        tintColor: Colors.main100,
        disabled: isEditMode
          ? updateDiaryMutation.isPending
          : createDiaryMutation.isPending,
      },
    ],
    [
      handleSaveDiary,
      isEditMode,
      createDiaryMutation.isPending,
      updateDiaryMutation.isPending,
      Colors.main100,
    ],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditMode ? t("edit_diary") : t("new_diary"),
      headerRight: () => (
        <IconsHeader headerRightBeginning={headerRightBeginning} />
      ),
    });
  }, [navigation, isEditMode, headerRightBeginning]);

  if (
    isEditMode ? updateDiaryMutation.isPending : createDiaryMutation.isPending
  ) {
    return <LoadingOverlay />;
  }

  return (
    <Layout withKeyboard style={{ padding: 12 }}>
      <DiaryForm
        formData={formData}
        setFormData={setFormData as Dispatch<SetStateAction<DiaryFormData>>}
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
    </Layout>
  );
};

export default DiaryEditorScreen;
