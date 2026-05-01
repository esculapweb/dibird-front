import {
  useState,
  useCallback,
  useLayoutEffect,
  useMemo,
  Dispatch,
  SetStateAction,
} from "react";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute, useNavigation } from "@react-navigation/native";

import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import ObservationForm from "../components/Observation/ObservationForm";
import { useCreateObservation } from "../hooks/Observation/useCreateObservation";
import { useUpdateItem } from "../hooks/useItem";
import { showError } from "../services/api";
import { useProfile } from "../store/profile-context";
import { setSession } from "../util/sessionStore";
import { setTypedNavigationCallback } from "../util/navigationCallbacks";
import { useEditorForm } from "../hooks/useEditorForm";
import { fetchDiarySpeciesIds } from "../util/fetches";
import IconsHeader from "../components/ui/IconsHeader";
import Layout from "../components/ui/Layout";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import {
  AppError,
  AppStackNavigationProp,
  AppStackRouteProp,
  ObservationFormData,
  PlaceData,
} from "../types";

const FORM_FIELDS = [
  "species",
  "territory",
  "place",
  "date_time",
  "time",
  "private",
  "quantity",
  "notes",
];

const ObservationEditorScreen = () => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const { profile } = useProfile();
  const [justSaved, setJustSaved] = useState(false);
  const queryClient = useQueryClient();
  const navigation = useNavigation<AppStackNavigationProp>();
  const route = useRoute<AppStackRouteProp<"ObservationEditor">>();

  const {
    observation,
    defaultTerritory,
    defaultPlace,
    defaultSpecies,
    diaryId,
    territoryValue: diaryTerritoryValue,
    returnMode,
  } = route.params || {};
  const isEditMode = !!observation;

  const {
    itemWithParsedDate: observationWithParsedDate,
    formData,
    setFormData,
    errors,
    setErrors,
    territoryValue,
    setTerritoryValue,
    speciesValue,
    setSpeciesValue,
    placeValue,
    setPlaceValue,
    speciesData,
    setSpeciesData,
    placeData,
    setPlaceData,
    validateForm,
  } = useEditorForm({
    item: observation ?? null,
    defaultTerritory: defaultTerritory ?? diaryTerritoryValue ?? undefined,
    defaultPlace,
    defaultSpecies,
    profile,
    hasSpecies: true,
    requiredFields: ["territory", "species", "date_time"],
    diaryId,
  });

  const { data: diarySpeciesIds } = useQuery({
    queryKey: ["DiarySpecies", diaryId],
    queryFn: () => fetchDiarySpeciesIds(diaryId!),
    enabled: !!diaryId,
    staleTime: 0,
  });

  const existingSpecies: Set<string | number> = new Set(
    (diarySpeciesIds ?? []).filter(
      (id: number) => id !== observationWithParsedDate?.species,
    ),
  );

  const createObservationMutation = useCreateObservation();
  const updateObservationMutation = useUpdateItem(
    observationWithParsedDate?.id,
    "Observation",
  );

  const extractApiError = (e: AppError) => ({
    title: isEditMode ? t("update_failed") : t("create_failed"),
    message:
      Object.values(e?.response?.data).flat().join("\n") ||
      (isEditMode
        ? t("could_not_update_observation")
        : t("could_not_create_observation")),
  });

  const handleMutateError = (e: AppError) => {
    const data = e?.response?.data;
    if (!data) {
      showError(e, extractApiError);
      return;
    }
    const errorField = FORM_FIELDS.find((field) => data?.[field]);
    if (errorField) {
      setErrors((prev) => ({ ...prev, [errorField]: data[errorField] }));
    } else {
      showError(e, extractApiError);
    }
  };

  const handleSaveObservation = useCallback(() => {
    if (!validateForm()) return;
    if (speciesValue === null || !territoryValue || !formData.date_time) return;
    const observationData: ObservationFormData = {
      ...formData,
      date_time: formData.date_time!,
      private: formData.private ?? false,
      species: speciesValue,
      territory: territoryValue,
      place: placeValue,
    };

    if (isEditMode) {
      updateObservationMutation.mutate(observationData, {
        onSuccess: () => navigation.goBack(),
        onError: handleMutateError,
      });
    } else {
      createObservationMutation.mutate(observationData, {
        onSuccess: (res) => {
          setSession("lastDate", observationData.date_time);
          if (returnMode === "back") {
            navigation.goBack();
          } else {
            requestAnimationFrame(() =>
              navigation.replace("ObservationDetail", {
                observationId: res.data.id,
              }),
            );
          }
        },
        onError: handleMutateError,
      });
    }
  }, [
    formData,
    speciesValue,
    territoryValue,
    placeValue,
    isEditMode,
    returnMode,
    updateObservationMutation,
    createObservationMutation,
    navigation,
    handleMutateError,
    validateForm,
  ]);

  const handleSaveAndAddAnother = useCallback(() => {
    if (!validateForm()) return;
    if (speciesValue === null || !territoryValue || !formData.date_time) return;

    const observationData: ObservationFormData = {
      ...formData,
      date_time: formData.date_time!,
      private: formData.private ?? false,
      species: speciesValue,
      territory: territoryValue,
      place: placeValue,
    };

    createObservationMutation.mutate(observationData, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["DiarySpecies", diaryId],
        });
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1500);
        setSpeciesValue(null);
        setSpeciesData(null);
        setFormData((prev) => ({
          ...prev,
          species: null,
          time: null,
          quantity: null,
          notes: null,
        }));
        setErrors({});
      },
      onError: handleMutateError,
    });
  }, [
    formData,
    speciesValue,
    territoryValue,
    placeValue,
    queryClient,
    diaryId,
    validateForm,
  ]);

  const handleAddNewPlace = useCallback(() => {
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
    navigation.navigate("PlaceEditor", { returnToScreen: "ObservationEditor" });
  }, [navigation, territoryValue]);

  const handleEditDiary = useCallback(() => {
    if (!diaryId) return;
    navigation.navigate("DiaryDetail", { diaryId });
  }, [diaryId, navigation]);

  const headerRightBeginning = useMemo(
    () => [
      {
        condition: true,
        onPress: handleSaveObservation,
        icon: "checkmark-circle" as const,
        size: 36,
        tintColor: Colors.main100,
        disabled: isEditMode
          ? updateObservationMutation.isPending
          : createObservationMutation.isPending,
      },
    ],
    [
      handleSaveObservation,
      isEditMode,
      createObservationMutation.isPending,
      updateObservationMutation.isPending,
      Colors.main100,
    ],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditMode ? t("edit_observation") : t("new_observation"),
      headerRight: () => (
        <IconsHeader headerRightBeginning={headerRightBeginning} />
      ),
    });
  }, [navigation, isEditMode, headerRightBeginning]);

  if (
    isEditMode
      ? updateObservationMutation.isPending
      : createObservationMutation.isPending
  ) {
    return <LoadingOverlay />;
  }

  const bottomEl = !!diaryId && !isEditMode && (
    <FlatButtonBottom
      onPress={handleSaveAndAddAnother}
      icon="add-outline"
      loading={createObservationMutation.isPending}
      savedLabel={justSaved ? t("observation_added") : undefined}
    >
      {t("save_and_add_another")}
    </FlatButtonBottom>
  );

  return (
    <Layout withKeyboard={true} bottom={bottomEl}>
      <ObservationForm
        formData={formData}
        setFormData={
          setFormData as Dispatch<SetStateAction<ObservationFormData>>
        }
        errors={errors}
        setErrors={setErrors}
        territoryValue={territoryValue}
        setTerritoryValue={setTerritoryValue}
        speciesValue={speciesValue}
        setSpeciesValue={setSpeciesValue}
        placeValue={placeValue}
        setPlaceValue={setPlaceValue}
        speciesData={speciesData}
        setSpeciesData={setSpeciesData}
        placeData={placeData}
        setPlaceData={setPlaceData}
        onAddNewPlace={handleAddNewPlace}
        isDiaryMode={!!diaryId}
        isEditMode={isEditMode}
        onEditDiary={handleEditDiary}
        existingSpecies={existingSpecies}
      />
    </Layout>
  );
};

export default ObservationEditorScreen;
