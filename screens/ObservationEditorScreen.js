import { useState, useCallback, useEffect } from "react";
import { StyleSheet, Platform, KeyboardAvoidingView } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import IconButton from "../components/ui/IconButton";
import ObservationForm from "../components/Observation/ObservationForm";
import { useCreateObservation } from "../hooks/Observation/useCreateObservation";
import { useUpdateItem } from "../hooks/useItem";
import { showError } from "../services/api";
import { useProfile } from "../store/profile-context";

import {
  getLastObservationDate,
  setLastObservationDate,
} from "../util/storageHelper";

const ObservationEditorScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const profileCtx = useProfile();

  const { observation } = route.params || {};
  const isEditMode = !!observation;

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

  const createObservationMutation = useCreateObservation();
  const updateObservationMutation = useUpdateItem(
    observation?.id,
    "Observation",
  );

  const [defaultDate, setDefaultDate] = useState(new Date());

  // Подгружаем дату последнего наблюдения
  // useEffect(() => {
  //   if (!isEditMode) {
  //     getLastObservationDate().then((lastDate) => {
  //       if (lastDate) setDefaultDate(lastDate);
  //     });
  //   }
  // }, [isEditMode]);

  const [formData, setFormData] = useState({
    species: observation?.species ?? "",
    territory: observation?.territory ?? "",
    place: observation?.place ?? null,
    date_time: observation?.date_time
      ? new Date(observation.date_time)
      : defaultDate,
    time: observation?.time ?? null,
    private: profileCtx.profile?.private_diary,
    quantity: observation?.quantity ?? null,
    notes: observation?.notes ?? null,
  });

  const [territoryValue, setTerritoryValue] = useState(formData.territory);
  const [speciesValue, setSpeciesValue] = useState(formData.species);
  const [placeValue, setPlaceValue] = useState(formData.place);
  const [dateTimeValue, setDateTimeValue] = useState(formData.date_time);
  const [errors, setErrors] = useState({});

  // Валидация
  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!territoryValue) newErrors.territory = t("territory_required");
    if (!speciesValue) newErrors.species = t("species_required");
    if (!dateTimeValue) newErrors.date_time = t("date_required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [territoryValue, speciesValue, dateTimeValue, t]);

  const extractApiError = (e) => ({
    title: isEditMode ? t("update_failed") : t("create_failed"),
    message:
      Object.values(e?.response?.data).flat().join("\n") ||
      (isEditMode
        ? t("could_not_update_observation")
        : t("could_not_create_observation")),
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

  // Сохранение наблюдения
  const handleSaveObservation = useCallback(() => {
    if (!validateForm()) return;

      console.log(formData)
      

    const observationData = {
      ...formData,
      species: speciesValue,
      territory: territoryValue,
      place: placeValue,
    };

    console.log(formData)

  

    if (isEditMode) {
      updateObservationMutation.mutate(observationData, {
        onSuccess: () => navigation.goBack(),
        onError: handleMutateError,
      });
    } else {
      createObservationMutation.mutate(observationData, {
        onSuccess: async (res) => {
          await setLastObservationDate(observationData.date_time);
          requestAnimationFrame(() =>
            navigation.replace("ObservationDetail", {
              observationId: res.data.id,
            }),
          );
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
    createObservationMutation,
    updateObservationMutation,
  ]);

  const headerRight = useCallback(
    () => (
      <IconButton
        icon="checkmark"
        onPress={handleSaveObservation}
        style={styles.saveButton}
        size={28}
        disabled={
          isEditMode
            ? updateObservationMutation.isPending
            : createObservationMutation.isPending
        }
        color={Colors.buttonBrightColor}
      />
    ),
    [
      handleSaveObservation,
      isEditMode,
      createObservationMutation.isPending,
      updateObservationMutation.isPending,
    ],
  );

  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? t("edit_observation") : t("new_observation"),
      headerRight,
    });
  }, [navigation, headerRight, isEditMode]);

  if (
    isEditMode
      ? updateObservationMutation.isPending
      : createObservationMutation.isPending
  )
    return <LoadingOverlay />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ObservationForm
        formData={formData}
        setFormData={setFormData}
        errors={errors}
        setErrors={setErrors}
        territoryValue={territoryValue}
        setTerritoryValue={setTerritoryValue}
        speciesValue={speciesValue}
        setSpeciesValue={setSpeciesValue}
        placeValue={placeValue}
        setPlaceValue={setPlaceValue}
        onAddNewPlace={(cb) =>
          navigation.navigate("PlaceEditorScreen", { onReturn: cb })
        }
      />
    </KeyboardAvoidingView>
  );
};

export default ObservationEditorScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundMain },
    saveButton: {
      backgroundColor: Colors.buttonBrightBg,
      borderRadius: 20,
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 0,
    },
  });
