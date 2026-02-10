import { useState, useCallback, useEffect } from "react";
import { Platform, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { useTranslation } from "react-i18next";
import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { useCreatePlace, useUpdatePlace } from "../hooks/usePlaceMutation";
import { PlaceMap } from "../components/Map/PlaceMap";
import IconButton from "../components/ui/IconButton";
import PlaceForm from "../components/Place/PlaceForm";
import { usePlaceLocation } from "../hooks/usePlaceLocation";

const PlaceEditorScreen = ({ navigation, route }) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);

  const { place } = route.params || {};
  const isEditMode = !!place;

  const {
    coords,
    zoom,
    accuracy,
    details,
    latText,
    setLatText,
    lngText,
    setLngText,
    isLoading: isLocating,
    updateCoords,
    useMyLocation,
  } = usePlaceLocation();

  const createPlaceMutation = useCreatePlace();
  const updatePlaceMutation = useUpdatePlace(place?.id);

  const [formData, setFormData] = useState({
    name: place?.name ?? "",
    territory: place?.territory ?? "",
  });
  const [errors, setErrors] = useState({});

  const initialCoords= place?.location?.coordinates ?? [0, 0];

  useEffect(() => {
    if (!isEditMode) {
      useMyLocation();
    } else {
      updateCoords(initialCoords);
      setLatText(initialCoords[1]?.toString() ?? "");
      setLngText(initialCoords[0]?.toString() ?? "");
    }
  }, []);

  const getSuggestedName = (details) => {
    if (details?.city && details?.raw?.county) return `${details.city}, ${details?.raw?.county}`;
    if (details?.city) return details.city;
    if (details?.address) return details.address;
    return "";
  }

  useEffect(() => {
    if (!details || isEditMode) return;
    const suggestedName = getSuggestedName(details);
    if (!suggestedName) return;

    setFormData((prev) => ({ ...prev, name: suggestedName }));
    setErrors((prev) => ({ ...prev, name: undefined }));
  }, [details, isEditMode]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = t("name_required");
    else if (formData.name.trim().length > 254)
      newErrors.name = t("name_too_long");

    if (!formData?.territory) newErrors.territory = t("territory_required");

    const [lng, lat] = coords ?? [];

    if (lat === null || isNaN(lat) || lat < -90 || lat > 90)
      newErrors.latitude = t("invalid_latitude");
    if (lng === null || isNaN(lng) || lng < -180 || lng > 180)
      newErrors.longitude = t("invalid_longitude");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, coords, t]);

  const handleMutateError = (err, message) => {
    if (err.response?.data) {
      message =
        typeof err.response.data === "string"
          ? err.response.data
          : Object.entries(err.response.data)
              .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
              .join("\n");
    }
    Alert.alert(t("error"), message);
  };

  const handleSavePlace = useCallback(() => {
    if (!validateForm()) return;

    const [lng, lat] = coords ?? [];
    const placeData = {
      name: formData.name.trim(),
      location: { type: "Point", coordinates: [lng, lat] },
      territory: formData.territory,
      favourite: place?.favourite ?? false,
    };

    if (isEditMode) {
      updatePlaceMutation.mutate(placeData, {
        onSuccess: () => navigation.goBack(),
        onError: (err) => handleMutateError(err, t("update_failed")),
      });
    } else {
      createPlaceMutation.mutate(placeData, {
        onSuccess: (res) =>
          requestAnimationFrame(() =>
            navigation.replace("PlaceDetail", { placeId: res.data.id }),
          ),
        onError: (err) => handleMutateError(err, t("create_failed")),
      });
    }
  }, [
    formData,
    coords,
    isEditMode,
    place,
    createPlaceMutation,
    updatePlaceMutation,
  ]);

  const HeaderRight = useCallback(
    () =>
      (
        isEditMode
          ? updatePlaceMutation.isLoading
          : createPlaceMutation.isLoading
      ) ? (
        <ActivityIndicator size="small" color={Colors.textMain} />
      ) : (
        <IconButton
          icon="checkmark"
          onPress={handleSavePlace}
          style={styles.createHeaderButton}
          size={28}
          disabled={isLocating}
          color={Colors.buttonBrightColor}
        />
      ),
    [
      handleSavePlace,
      isLocating,
      isEditMode,
      createPlaceMutation.isLoading,
      updatePlaceMutation.isLoading,
      Colors,
    ],
  );

  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? t("edit_place") : t("new_place"),
      headerShadowVisible: false,
      headerRight: HeaderRight,
    });
  }, [navigation, HeaderRight, isEditMode]);

  if (
    isEditMode ? updatePlaceMutation.isLoading : createPlaceMutation.isLoading
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
      <PlaceMap
        coords={coords}
        zoomLevel={zoom}
        accuracy={accuracy}
        isGeocoding={isLocating}
        onCoordsChange={updateCoords}
        onUseMyLocation={useMyLocation}
      />

      <PlaceForm
        onCoordsChange={updateCoords}
        formData={formData}
        coords={coords}
        latText={latText}
        setLatText={setLatText}
        lngText={lngText}
        setLngText={setLngText}
        setFormData={setFormData}
        errors={errors}
        setErrors={setErrors}
        locationDetails={details}
      />
    </KeyboardAwareScrollView>
  );
};

export default PlaceEditorScreen;

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
