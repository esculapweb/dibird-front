import { useState, useCallback, useEffect } from "react";
import {
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { useCreatePlace } from "../hooks/usePlaceMutation";
import { PlaceMap } from "../components/Map/PlaceMap";
import IconButton from "../components/ui/IconButton";
import PlaceForm from "../components/Place/PlaceForm";
import { usePlaceLocation } from "../hooks/usePlaceLocation";

const AddPlaceScreen = ({ navigation }) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);

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

  const [formData, setFormData] = useState({ name: "" });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    useMyLocation();
  }, [useMyLocation]);

  useEffect(() => {
    if (!details) return;
    const suggestedName = details.city || details.address || "";
    if (!suggestedName) return;

    if (!formData.name.trim())
      setFormData((prev) => ({ ...prev, name: suggestedName }));
  }, [details]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = t("name_required");
    else if (formData.name.trim().length > 254)
      newErrors.name = t("name_too_long");

    const [lng, lat] = coords ?? [];

    if (isNaN(lat) || lat < -90 || lat > 90)
      newErrors.latitude = t("invalid_latitude");
    if (isNaN(lng) || lng < -180 || lng > 180)
      newErrors.longitude = t("invalid_longitude");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, coords, t]);

  const handleCreatePlace = useCallback(() => {
    if (!validateForm()) return;

    const [lng, lat] = coords ?? [];

    const placeData = {
      name: formData.name.trim(),
      location: { type: "Point", coordinates: [lng, lat] },
      favourite: false,
    };

    createPlaceMutation.mutate(placeData, {
      onSuccess: (res) =>
        requestAnimationFrame(() =>
          navigation.replace("PlaceDetail", { placeId: res.data.id }),
        ),
      onError: (err) => {
        console.error("Create place error:", err);
        let message = t("create_failed");
        if (err.response?.data) {
          message =
            typeof err.response.data === "string"
              ? err.response.data
              : Object.entries(err.response.data)
                  .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                  .join("\n");
        }
        Alert.alert(t("error"), message);
      },
    });
  }, [formData, coords, validateForm, createPlaceMutation, navigation]);

  const HeaderRight = useCallback(
    () =>
      createPlaceMutation.isLoading ? (
        <ActivityIndicator size="small" color={Colors.textMain} />
      ) : (
        <IconButton
          icon="checkmark"
          onPress={handleCreatePlace}
          style={styles.createHeaderButton}
          size={24}
          disabled={createPlaceMutation.isLoading || isLocating}
          color={Colors.buttonBrightColor}
        />
      ),
    [handleCreatePlace, isLocating, createPlaceMutation.isLoading, Colors],
  );

  useEffect(() => {
    navigation.setOptions({
      title: t("new_place"),
      headerShadowVisible: false,
      headerRight: HeaderRight,
    });
  }, [navigation, HeaderRight]);

  if (createPlaceMutation.isLoading) return <LoadingOverlay />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <PlaceMap
          style={styles.map}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AddPlaceScreen;

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundMain },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    map: { flex: 1 },
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
