import { useState, useCallback, useEffect } from "react";
import { StyleSheet, Dimensions, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useTranslation } from "react-i18next";

import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { useUpdateItem } from "../hooks/useItem";
import IconButton from "../components/ui/IconButton";
import ObservationForm from "../components/Observation/ObservationForm";
import { useCreateObservation } from "../hooks/Observation/useObservationMutation";
import { showError } from "../services/api";

const ObservationEditorScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const type = "Observation";

  const FORM_FIELDS = ["species", "territory"];

  const { observation } = route.params || {};
  const isEditMode = !!observation;
  const screenHeight = Dimensions.get("window").height;

  const createObservationMutation = useCreateObservation();
  const updateObservationMutation = useUpdateItem(observation?.id, type);

  const [formData, setFormData] = useState({
    species: observation?.species ?? "",
    territory: observation?.territory ?? "",
  });
  const [errors, setErrors] = useState({});

  const validateForm = useCallback(() => {
    const newErrors = {};
    // if (!formData.name.trim()) newErrors.name = t("name_required");
    // else if (formData.name.trim().length > 254)
    //   newErrors.name = t("name_too_long");

    // if (!formData?.territory) newErrors.territory = t("territory_required");

    // if (!latText?.trim()) {
    //   newErrors.latitude = t("invalid_latitude");
    // } else {
    //   const lat = Number(latText);
    //   if (isNaN(lat) || lat < -90 || lat > 90) {
    //     newErrors.latitude = t("invalid_latitude");
    //   }
    // }

    // if (!lngText?.trim()) {
    //   newErrors.longitude = t("invalid_longitude");
    // } else {
    //   const lng = Number(lngText);
    //   if (isNaN(lng) || lng < -180 || lng > 180) {
    //     newErrors.longitude = t("invalid_longitude");
    //   }
    // }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);

  const extractApiError = (e) => {
    return {
      title: isEditMode ? t("update_failed") : t("create_failed"),
      message:
        Object.values(e?.response?.data).flat().join("\n") ||
        (isEditMode
          ? t("could_not_update_observation")
          : t("could_not_create_observation")),
    };
  };

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

    //   const normalized = normalizeCoords(lngText, latText, 4);
    //   if (!normalized) return;

    //   const { lng, lat, lngText: newLngText, latText: newLatText } = normalized;
    //   updateCoords([lng, lat], {
    //     fromManual: true,
    //     normalizeOnSave: true,
    //     withGeocode: false,
    //   });
    //   setLatText(newLatText);
    //   setLngText(newLngText);

    //   const placeData = {
    //     name: formData.name.trim(),
    //     location: { type: "Point", coordinates: [lng, lat] },
    //     territory: formData.territory,
    //     favourite: place?.favourite ?? false,
    //   };

    if (isEditMode) {
      updateObservationMutation.mutate(observationData, {
        onSuccess: () => navigation.goBack(),
        onError: (e) => handleMutateError(e),
      });
    } else {
      createObservationMutation.mutate(observationData, {
        onSuccess: (res) =>
          requestAnimationFrame(() =>
            navigation.replace("ObservationDetail", {
              observationId: res.data.id,
            }),
          ),
        onError: (e) => handleMutateError(e),
      });
    }
  }, [formData, isEditMode, observation]);

  const headerRight = useCallback(
    () => (
      <IconButton
        icon="checkmark"
        onPress={handleSaveObservation}
        style={styles.createHeaderButton}
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
    <KeyboardAwareScrollView
      contentContainerStyle={styles.container}
      enableOnAndroid
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={Platform.OS === "ios" ? 20 : 80}
      style={styles.container}
    >
      <ObservationForm />
    </KeyboardAwareScrollView>
  );
};

export default ObservationEditorScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundMain },
    createHeaderButton: {
      backgroundColor: Colors.buttonBrightBg,
      borderRadius: 20,
      width: 36,
      height: 36,
      marginRight: 0,
      justifyContent: "center",
      alignItems: "center",
    },
  });
