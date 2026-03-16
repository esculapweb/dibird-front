import { useState, useCallback, useLayoutEffect } from "react";
import { StyleSheet, Platform, KeyboardAvoidingView, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import IconButton from "../components/ui/IconButton";
import DiaryObservationForm from "../components/Diary/DiaryObservationForm";
import { useCreateDiaryObservation } from "../hooks/Diary/useCreateDiaryObservation";
import { useUpdateItem } from "../hooks/useItem";
import { showError } from "../services/api";

const FORM_FIELDS = ["species", "time", "quantity", "notes"];

const DiaryObservationEditorScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);

  const { observation, diaryId, territoryValue } = route.params || {};
  const isEditMode = !!observation;

  const createDiaryObservationMutation = useCreateDiaryObservation();
  const updateDiaryObservationMutation = useUpdateItem(
    observation?.id,
    "Observation",
  );

  const [formData, setFormData] = useState(() => {
    return {
      species: observation?.species ?? null,
      time: observation?.time ?? null,
      quantity: observation?.quantity ?? null,
      notes: observation?.notes ?? null,
      diary: diaryId,
    };
  });

  const [speciesValue, setSpeciesValue] = useState(formData.species);
  const [errors, setErrors] = useState({});
  const [speciesData, setSpeciesData] = useState(
    observation?.species_data ?? null,
  );

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!speciesValue) newErrors.species = t("species_required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [speciesValue, t]);

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

  const handleSaveObservation = useCallback(() => {
    if (!validateForm()) return;
    const observationData = {
      ...formData,
      species: speciesValue,
    };

    if (isEditMode) {
      updateDiaryObservationMutation.mutate(observationData, {
        onSuccess: () => navigation.goBack(),
        onError: handleMutateError,
      });
    } else {
      createDiaryObservationMutation.mutate(observationData, {
        onSuccess: () => navigation.goBack(),
        onError: handleMutateError,
      });
    }
  }, [formData, speciesValue, isEditMode]);

  const headerRight = useCallback(
    () => (
      <View style={styles.headerButtons}>
        <IconButton
          icon="checkmark"
          onPress={handleSaveObservation}
          style={styles.saveButton}
          size={28}
          disabled={
            isEditMode
              ? updateDiaryObservationMutation.isPending
              : createDiaryObservationMutation.isPending
          }
          color={Colors.buttonBrightColor}
        />
      </View>
    ),
    [
      handleSaveObservation,
      isEditMode,
      createDiaryObservationMutation.isPending,
      updateDiaryObservationMutation.isPending,
    ],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditMode ? t("edit_observation") : t("new_observation"),
      headerRight,
    });
  }, [navigation, headerRight, isEditMode]);

  if (
    isEditMode
      ? updateDiaryObservationMutation.isPending
      : createDiaryObservationMutation.isPending
  ) {
    return <LoadingOverlay />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <DiaryObservationForm
        formData={formData}
        setFormData={setFormData}
        errors={errors}
        setErrors={setErrors}
        territoryValue={territoryValue}
        speciesValue={speciesValue}
        setSpeciesValue={setSpeciesValue}
        speciesData={speciesData}
        setSpeciesData={setSpeciesData}
      />
    </KeyboardAvoidingView>
  );
};

export default DiaryObservationEditorScreen;

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
