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
import {
  useCreateObservation,
  useUpdateObservation,
} from "../hooks/Observation/useOfflineObservation";
import { useProfile } from "../store/profile-context";
import { setSession } from "../util/sessionStore";
import { setTypedNavigationCallback } from "../util/navigationCallbacks";
import { useEditorForm } from "../hooks/useEditorForm";
import { fetchDiarySpeciesIds } from "../util/fetches";
import IconsHeader from "../components/ui/IconsHeader";
import Layout from "../components/ui/Layout";
import FlatButtonBottom from "../components/ui/FlatButtonBottom";
import { useApiError } from "../hooks/useApiError";
import {
  AppError,
  AppStackNavigationProp,
  AppStackRouteProp,
  ErrorExtractor,
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
  const { showErrorToast } = useApiError();

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

  const buildObservationPayload = (
    data: ObservationFormData,
  ): ObservationFormData => {
    const isDiary = !!data.diary;

    if (isDiary) {
      return {
        species: data.species,
        diary: data.diary,
        time: data.time ?? null,
        quantity: data.quantity ?? null,
        notes: data.notes ?? "",
        location_private: data.location_private ?? true,
      };
    }

    return {
      species: data.species,
      territory: data.territory,
      place: data.place ?? null,
      date_time: data.date_time,
      time: data.time ?? null,
      private: data.private ?? false,
      quantity: data.quantity ?? null,
      notes: data.notes ?? "",
      location_private: data.location_private ?? true, 
    };
  };

  const createObservationMutation = useCreateObservation();
  const updateObservationMutation = useUpdateObservation(
    observationWithParsedDate?.id,
  );

  const extractApiError = useCallback<ErrorExtractor>(
    (err) => ({
      title: isEditMode ? t("update_failed") : t("create_failed"),
      message:
        // err.response is undefined for any response-less failure (offline,
        // timeout, unreachable backend) — Object.values(undefined) throws, so
        // this only ever ran the happy path where the server actually replied.
        (err?.response?.data
          ? Object.values(err.response.data).flat().join("\n")
          : "") ||
        (isEditMode
          ? t("could_not_update_observation")
          : t("could_not_create_observation")),
    }),
    [t],
  );

  const handleMutateError = (e: AppError) => {
    const data = e?.response?.data;
    if (!data) {
      showErrorToast(
        e,
        "ObservationEditorScreen:handleMutateError",
        extractApiError,
      );
      return;
    }
    const errorField = FORM_FIELDS.find((field) => data?.[field]);
    if (errorField) {
      setErrors((prev) => ({ ...prev, [errorField]: data[errorField] }));
    } else {
      showErrorToast(
        e,
        "ObservationEditorScreen:handleMutateError",
        extractApiError,
      );
    }
  };

  const handleSaveObservation = useCallback(() => {
    if (!validateForm()) return;
    if (speciesValue === null || !territoryValue || !formData.date_time) return;

    const payload = buildObservationPayload({
      ...formData,
      species: speciesValue,
      territory: territoryValue,
      place: placeValue,
    });

    if (isEditMode) {
      updateObservationMutation.mutate(
        { payload, speciesData, placeData },
        {
          onSuccess: () => navigation.goBack(),
          onError: handleMutateError,
        },
      );
    } else {
      createObservationMutation.mutate(
        { payload, speciesData, placeData },
        {
          onSuccess: (item) => {
            setSession("lastDate", payload.date_time);
            if (returnMode === "back") {
              navigation.goBack();
            } else {
              requestAnimationFrame(() =>
                navigation.replace("ObservationDetail", {
                  observationId: item.id,
                }),
              );
            }
          },
          onError: handleMutateError,
        },
      );
    }
  }, [
    formData,
    speciesValue,
    territoryValue,
    placeValue,
    speciesData,
    placeData,
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

    const payload = buildObservationPayload({
      ...formData,
      species: speciesValue,
      territory: territoryValue,
      place: placeValue,
    });

    createObservationMutation.mutate(
      { payload, speciesData, placeData },
      {
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
      },
    );
  }, [
    formData,
    speciesValue,
    territoryValue,
    placeValue,
    speciesData,
    placeData,
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
