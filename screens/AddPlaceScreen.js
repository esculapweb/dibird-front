import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../store/theme-context";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { useCreatePlace } from "../hooks/usePlaceMutation";
import { cachedReverseGeocode } from "../services/geocoding";
import { Config } from "../constants/config";
import { PlaceMap } from "../components/Map/PlaceMap";
import * as Location from "expo-location";
import IconButton from "../components/ui/IconButton";

const AddPlaceScreen = ({ navigation }) => {
  const { Colors, theme } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors, theme);

  const createPlaceMutation = useCreatePlace();

  const defaultCoords = Config.defaultCoords;

  const defLng = Config.defaultCoords[0].toFixed(4);
  const defLat = Config.defaultCoords[1].toFixed(4);

  const [formData, setFormData] = useState({
    name: "",
    latitude: defLng,
    longitude: defLat,
  });

  const [errors, setErrors] = useState({});
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [locationDetails, setLocationDetails] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(defaultCoords);
  const [accuracy, setAccuracy] = useState(null);

  const [zoomLevel, setZoomLevel] = useState(12);

  const fetchLocationDetails = useCallback(
    async (lat, lng) => {
      setIsGeocoding(true);
      try {
        const details = await cachedReverseGeocode(lat, lng);
        if (details) {
          setLocationDetails(details);
          if (!formData.name.trim() && details.city) {
            setFormData((prev) => ({ ...prev, name: details.city }));
          }
        }
      } catch (e) {
        console.error("Geocoding error:", e);
      } finally {
        setIsGeocoding(false);
      }
    },
    [formData.name],
  );

  const handleCoordsChange = useCallback(
    ([lng, lat]) => {
      setCurrentCoords([lng, lat]);
      setFormData((prev) => ({
        ...prev,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));
      fetchLocationDetails(lat, lng);
    },
    [fetchLocationDetails],
  );

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = t("name_required");
    else if (formData.name.trim().length > 100)
      newErrors.name = t("name_too_long");

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90)
      newErrors.latitude = t("invalid_latitude");
    if (isNaN(lng) || lng < -180 || lng > 180)
      newErrors.longitude = t("invalid_longitude");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleCreatePlace = useCallback(() => {
    if (!validateForm()) return;

    const latitude = parseFloat(formData.latitude);
    const longitude = parseFloat(formData.longitude);

    if (isNaN(latitude) || isNaN(longitude)) {
      Alert.alert(t("error"), t("invalid_coordinates"));
      return;
    }

    const placeData = {
      name: formData.name.trim(),
      location: { type: "Point", coordinates: [longitude, latitude] },
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
  }, [formData, validateForm, createPlaceMutation, navigation]);

  const handleUseMyLocation = useCallback(async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("permission_denied"), t("location_permission_message"), [
          { text: t("ok") },
        ]);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      });
      handleCoordsChange([loc.coords.longitude, loc.coords.latitude]);
      setZoomLevel(14);
      setAccuracy(loc.coords.accuracy);
    } catch (err) {
      console.error("Location error:", err);
      Alert.alert(t("error"), t("location_error"));
      handleCoordsChange(defaultCoords);
      setZoomLevel(12);
    } finally {
      setIsGettingLocation(false);
    }
  }, [handleCoordsChange]);

  useEffect(() => {
    handleUseMyLocation();
  }, []);

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
          disabled={createPlaceMutation.isLoading || isGettingLocation}
          color={Colors.buttonBrightColor}
        />
      ),
    [handleCreatePlace, isGettingLocation, createPlaceMutation.isLoading],
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
        {/* Карта */}
        <View style={styles.mapSection}>
          <PlaceMap
            style={styles.map}
            coords={currentCoords}
            zoomLevel={zoomLevel}
            onCoordsChange={handleCoordsChange}
            onUseMyLocation={handleUseMyLocation}
            isGeocoding={isGeocoding || isGettingLocation}
            accuracy={accuracy}
          />
        </View>

        <View style={styles.formSection}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="pricetag-outline"
                size={18}
                color={Colors.textSecondary}
              />
              <Text style={styles.cardTitle}>
                {t("place_name")} <Text style={styles.required}>*</Text>
              </Text>
            </View>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={formData.name}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, name: text }));
                if (errors.name)
                  setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder={t("enter_place_name")}
              placeholderTextColor={Colors.textSecondary}
              maxLength={100}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name="globe-outline"
                size={18}
                color={Colors.textSecondary}
              />
              <Text style={styles.cardTitle}>{t("coordinates")}</Text>
            </View>
            <View style={styles.coordsContainer}>
              <View style={styles.coordInputWrapper}>
                <View style={styles.coordLabelRow}>
                  <Ionicons
                    name="arrow-up-outline"
                    size={14}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.coordLabel}>{t("latitude")}</Text>
                </View>
                <TextInput
                  style={[
                    styles.coordInput,
                    errors.latitude && styles.inputError,
                  ]}
                  value={formData.latitude}
                  onChangeText={(text) => {
                    const newLat = parseFloat(text);
                    if (!isNaN(newLat) && newLat >= -90 && newLat <= 90)
                      handleCoordsChange([currentCoords[0], newLat]);
                    setFormData((prev) => ({ ...prev, latitude: text }));
                    if (errors.latitude)
                      setErrors((prev) => ({ ...prev, latitude: undefined }));
                  }}
                  placeholder={defLat}
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="decimal-pad"
                />
                {errors.latitude && (
                  <Text style={styles.errorText}>{errors.latitude}</Text>
                )}
              </View>

              <View style={styles.coordInputWrapper}>
                <View style={styles.coordLabelRow}>
                  <Ionicons
                    name="arrow-forward-outline"
                    size={14}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.coordLabel}>{t("longitude")}</Text>
                </View>
                <TextInput
                  style={[
                    styles.coordInput,
                    errors.longitude && styles.inputError,
                  ]}
                  value={formData.longitude}
                  onChangeText={(text) => {
                    const newLng = parseFloat(text);
                    if (!isNaN(newLng) && newLng >= -180 && newLng <= 180)
                      handleCoordsChange([newLng, currentCoords[1]]);
                    setFormData((prev) => ({ ...prev, longitude: text }));
                    if (errors.longitude)
                      setErrors((prev) => ({ ...prev, longitude: undefined }));
                  }}
                  placeholder={defLng}
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="decimal-pad"
                />
                {errors.longitude && (
                  <Text style={styles.errorText}>{errors.longitude}</Text>
                )}
              </View>
            </View>
          </View>

          {locationDetails && (
            <View style={styles.card}>
              {locationDetails.city && (
                <DetailItem
                  label={t("city")}
                  value={locationDetails.city}
                  icon="business-outline"
                />
              )}
              {locationDetails.country && (
                <DetailItem
                  label={t("country")}
                  value={locationDetails.country}
                  icon="flag-outline"
                />
              )}
              {locationDetails.address && (
                <DetailItem
                  label={t("address")}
                  value={locationDetails.address}
                  icon="navigate-outline"
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const DetailItem = ({ label, value, icon }) => {
  const { Colors } = useTheme();
  const styles = detailStyles(Colors);
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={16} color={Colors.accent} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
};

const detailStyles = (Colors) =>
  StyleSheet.create({
    detailItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      paddingVertical: 10,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.divider,
    },
    detailContent: { flex: 1 },
    detailLabel: {
      fontSize: 12,
      color: Colors.textSecondary,
      marginBottom: 2,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    detailValue: { fontSize: 15, color: Colors.textMain, lineHeight: 20 },
  });

export default AddPlaceScreen;

const stylesFn = (Colors, theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundMain },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    mapSection: { height: 300, position: "relative" },
    map: { flex: 1 },
    formSection: { padding: 16, paddingTop: 20 },
    card: {
      backgroundColor: Colors.primary200,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
      gap: 8,
    },
    cardTitle: { fontSize: 16, fontWeight: "600", color: Colors.textMain },
    required: { color: Colors.error600 },
    input: {
      backgroundColor: Colors.primary100,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: Colors.textMain,
    },
    inputError: { borderColor: Colors.error600 },
    errorText: {
      fontSize: 13,
      color: Colors.error600,
      marginTop: 6,
      marginLeft: 4,
    },
    coordsContainer: { flexDirection: "row", gap: 12, marginBottom: 12 },
    coordInputWrapper: { flex: 1 },
    coordLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 6,
      gap: 4,
    },
    coordLabel: {
      fontSize: 13,
      fontWeight: "500",
      color: Colors.textSecondary,
    },
    coordInput: {
      backgroundColor: Colors.primary100,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: Colors.textMain,
      textAlign: "center",
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
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
