import { useState, useCallback, useLayoutEffect } from "react";
import { StyleSheet, Platform, KeyboardAvoidingView, View } from "react-native";
import { useTranslation } from "react-i18next";
import Toast from "react-native-toast-message";

import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import IconButton from "../components/ui/IconButton";
import ObservationForm from "../components/Observation/ObservationForm";
import { useCreateObservation } from "../hooks/Observation/useCreateObservation";
import { useUpdateItem } from "../hooks/useItem";
import { showError } from "../services/api";
import { useProfile } from "../store/profile-context";
import { getSession, setSession } from "../util/sessionStore";
import { setNavigationCallback } from "../util/navigationCallbacks";

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

const ObservationEditorScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { profile } = useProfile();

  const { observation, defaultTerritory } = route.params || {};
  const isEditMode = !!observation;

  const observationWithParsedDate = observation
    ? {
        ...observation,
        date_time: observation.date_time
          ? new Date(observation.date_time)
          : undefined,
      }
    : undefined;

  const createObservationMutation = useCreateObservation();
  const updateObservationMutation = useUpdateItem(
    observationWithParsedDate?.id,
    "Observation",
  );

  const [territoryValue, setTerritoryValue] = useState(
    () => observationWithParsedDate?.territory ?? defaultTerritory ?? "",
  );

  const [formData, setFormData] = useState(() => {
    const initialDate =
      observationWithParsedDate?.date_time ??
      getSession("lastDate") ??
      new Date();

    return {
      species: observationWithParsedDate?.species ?? null,
      territory: territoryValue,
      place: observationWithParsedDate?.place ?? null,
      date_time: initialDate,
      time: observationWithParsedDate?.time ?? null,
      private: observationWithParsedDate?.private ?? profile?.private_diary,
      quantity: observationWithParsedDate?.quantity ?? null,
      notes: observationWithParsedDate?.notes ?? null,
    };
  });

  const [speciesValue, setSpeciesValue] = useState(formData.species);
  const [placeValue, setPlaceValue] = useState(formData.place);
  const [errors, setErrors] = useState({});
  const [speciesData, setSpeciesData] = useState(
    observationWithParsedDate?.species_data ?? null,
  );
  const [placeData, setPlaceData] = useState(
    observationWithParsedDate?.place_data ?? null,
  );

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!territoryValue) newErrors.territory = t("territory_required");
    if (!speciesValue) newErrors.species = t("species_required");
    if (!formData.date_time) newErrors.date_time = t("date_required");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [territoryValue, speciesValue, formData.date_time, t]);

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
          requestAnimationFrame(() =>
            navigation.replace("ObservationDetail", {
              observationId: res.data.id,
            }),
          );
        },
        onError: handleMutateError,
      });
    }
  }, [formData, speciesValue, territoryValue, placeValue, isEditMode]);

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
    navigation.navigate("PlaceEditor", { returnToScreen: "ObservationEditor" });
  }, [navigation, territoryValue]);

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
              ? updateObservationMutation.isPending
              : createObservationMutation.isPending
          }
          color={Colors.buttonBrightColor}
        />
      </View>
    ),
    [
      handleSaveObservation,
      isEditMode,
      createObservationMutation.isPending,
      updateObservationMutation.isPending,
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
      ? updateObservationMutation.isPending
      : createObservationMutation.isPending
  ) {
    return <LoadingOverlay />;
  }

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
        speciesData={speciesData}
        setSpeciesData={setSpeciesData}
        placeData={placeData}
        setPlaceData={setPlaceData}
        onAddNewPlace={handleAddNewPlace}
      />
    </KeyboardAvoidingView>
  );
};

export default ObservationEditorScreen;

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
