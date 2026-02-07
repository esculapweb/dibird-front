import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../store/theme-context";
import {
  MapView,
  Camera,
  RasterSource,
  RasterLayer,
  MarkerView,
} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import Button from "../components/ui/Button";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import { useCreatePlace } from "../hooks/usePlaceMutation";
import { useNavigation } from "@react-navigation/native";

const AddPlaceScreen = () => {
  const navigation = useNavigation();
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);

  const createPlaceMutation = useCreatePlace();

  const mapRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    latitude: "",
    longitude: "",
  });

  const [errors, setErrors] = useState({});
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false); // ← Новое состояние для загрузки

  // Координаты по умолчанию
  const defaultCoords = [13.405, 52.52];
  const [currentCoords, setCurrentCoords] = useState(defaultCoords);
  const [lng, lat] = currentCoords;

  const shouldUpdateMarkerRef = useRef(false);

  // Добавляем состояние для управления камерой
  const [cameraKey, setCameraKey] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(12);

  // Обновляем поля при изменении координат
  const updateFormFromCoords = useCallback(([newLng, newLat]) => {
    setCurrentCoords([newLng, newLat]);
    setFormData((prev) => ({
      ...prev,
      latitude: newLat.toFixed(6),
      longitude: newLng.toFixed(6),
    }));
  }, []);

  // Функция для анимации перехода камеры
  const animateCamera = useCallback((newCoords, newZoom = 14) => {
    // Устанавливаем флаг, что нужно обновить маркер
    shouldUpdateMarkerRef.current = true;

    // Обновляем координаты (камера будет использовать эти)
    setCurrentCoords(newCoords);
    setZoomLevel(newZoom);

    // Форсируем ререндер камеры
    setCameraKey((prev) => prev + 1);

    // Обновляем форму данных
    setFormData((prev) => ({
      ...prev,
      latitude: newCoords[1].toFixed(6),
      longitude: newCoords[0].toFixed(6),
    }));
  }, []);

  const handleMapPress = useCallback(
    (event) => {
      const { geometry } = event;
      if (geometry?.coordinates) {
        updateFormFromCoords(geometry.coordinates);
      }
    },
    [updateFormFromCoords],
  );

  useEffect(() => {
    if (shouldUpdateMarkerRef.current) {
      shouldUpdateMarkerRef.current = false;
      setCurrentCoords((prev) => [...prev]);
    }
  }, [cameraKey]);

  // Валидация формы
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t("name_required");
    } else if (formData.name.trim().length > 100) {
      newErrors.name = t("name_too_long");
    }

    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      newErrors.latitude = t("invalid_latitude");
    }

    if (isNaN(lng) || lng < -180 || lng > 180) {
      newErrors.longitude = t("invalid_longitude");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);

  // Обработчик создания места
  const handleCreatePlace = useCallback(() => {
    if (!validateForm()) return;

    const placeData = {
      name: formData.name.trim(),
      location: {
        type: "Point",
        coordinates: [
          parseFloat(formData.longitude),
          parseFloat(formData.latitude),
        ],
      },
      favourite: false,
    };

    createPlaceMutation.mutate(placeData, {
      onSuccess: (createdPlace) => {
        Alert.alert(t("success"), t("place_created_success"), [
          {
            text: t("view"),
            onPress: () => {
              navigation.replace("PlaceDetail", { placeId: createdPlace.id });
            },
          },
          {
            text: t("add_another"),
            style: "cancel",
            onPress: () => {
              // Сброс формы для добавления следующего места
              setFormData({ name: "", latitude: "", longitude: "" });
              setCurrentCoords(defaultCoords);
              setZoomLevel(12);
              setErrors({});
            },
          },
        ]);
      },
      onError: (error) => {
        Alert.alert(t("error"), error.message || t("create_failed"));
      },
    });
  }, [formData, validateForm, createPlaceMutation, navigation, t]);

  // Кнопка "Использовать мое местоположение" - ИСПРАВЛЕННЫЙ КОД
  const handleUseMyLocation = useCallback(async () => {
    setIsGettingLocation(true);

    try {
      // 1. Запрашиваем разрешение
      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(t("permission_denied"), t("location_permission_message"), [
          { text: t("ok") },
        ]);
        setIsGettingLocation(false);
        return;
      }

      // 2. Получаем текущее местоположение
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      });

      const newCoords = [location.coords.longitude, location.coords.latitude];

      // 3. Анимируем переход к новым координатам
      animateCamera(newCoords, 14);
    } catch (error) {
      console.error("Error getting location:", error);

      let errorMessage = t("location_error");
      if (error.code === "E_LOCATION_TIMEOUT") {
        errorMessage = t("location_timeout");
      } else if (error.code === "E_LOCATION_SERVICES_DISABLED") {
        errorMessage = t("location_services_disabled");
      }

      Alert.alert(t("error"), errorMessage);

      // Fallback: используем координаты по умолчанию
      animateCamera(defaultCoords, 12);
    } finally {
      setIsGettingLocation(false);
    }
  }, [t, animateCamera]);

  // Заголовок экрана
  useEffect(() => {
    navigation.setOptions({
      title: t("add_new_place"),
      headerShadowVisible: false,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          disabled={isGettingLocation || createPlaceMutation.isLoading}
        >
          <Ionicons
            name="close-outline"
            size={24}
            color={
              isGettingLocation || createPlaceMutation.isLoading
                ? Colors.textTertiary
                : Colors.textMain
            }
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, Colors, t, isGettingLocation, createPlaceMutation.isLoading]);

  // Показываем LoadingOverlay при создании места
  if (createPlaceMutation.isLoading) {
    return <LoadingOverlay />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Карта на весь экран */}
        <View style={styles.mapSection}>
          <MapView
            ref={mapRef}
            style={styles.map}
            onPress={handleMapPress}
            onRegionWillChange={() => setIsMapInteracting(true)}
            onRegionDidChange={() => setIsMapInteracting(false)}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            {/* Камера с key для анимации */}
            <Camera
              key={`camera-${cameraKey}`}
              centerCoordinate={currentCoords}
              zoomLevel={zoomLevel}
              animationDuration={1000}
            />

            <RasterSource
              id="osmTiles"
              tileUrlTemplates={[
                "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              ]}
              tileSize={256}
            >
              <RasterLayer id="osmLayer" sourceID="osmTiles" />
            </RasterSource>

            <MarkerView coordinate={[lng, lat]} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.markerContainer}>
                <Ionicons
                  name="location-sharp"
                  size={36}
                  color={Colors.error600}
                />
              </View>
            </MarkerView>
          </MapView>

          <View style={styles.mapOverlay}>
            <Text style={styles.mapHint}>{t("tap_to_select_location")}</Text>

            <TouchableOpacity
              style={[
                styles.locationButton,
                isGettingLocation && styles.locationButtonDisabled,
              ]}
              onPress={handleUseMyLocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <Ionicons name="time-outline" size={20} color={Colors.white} />
              ) : (
                <Ionicons name="navigate" size={20} color={Colors.white} />
              )}
              <Text style={styles.locationButtonText}>
                {isGettingLocation
                  ? t("getting_location")
                  : t("use_my_location")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Форма ввода */}
        <View style={styles.formSection}>
          {/* Название места */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              {t("place_name")} <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={formData.name}
              onChangeText={(text) => {
                setFormData((prev) => ({ ...prev, name: text }));
                if (errors.name)
                  setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder={t("enter_place_name")}
              placeholderTextColor={Colors.textTertiary}
              maxLength={100}
              autoFocus={true}
              editable={!isGettingLocation && !createPlaceMutation.isLoading}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Поля координат */}
          <View style={styles.coordsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("coordinates")}</Text>
              <Text style={styles.coordsValue}>
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </Text>
            </View>

            <View style={styles.coordsInputs}>
              <View style={styles.coordInputGroup}>
                <Text style={styles.coordLabel}>{t("latitude")}</Text>
                <TextInput
                  style={[
                    styles.coordInput,
                    errors.latitude && styles.inputError,
                    (isGettingLocation || createPlaceMutation.isLoading) &&
                      styles.inputDisabled,
                  ]}
                  value={formData.latitude}
                  onChangeText={(text) => {
                    const newLat = parseFloat(text);
                    if (!isNaN(newLat) && newLat >= -90 && newLat <= 90) {
                      setCurrentCoords([lng, newLat]);
                    }
                    setFormData((prev) => ({ ...prev, latitude: text }));
                    if (errors.latitude)
                      setErrors((prev) => ({ ...prev, latitude: undefined }));
                  }}
                  placeholder="52.5200"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  editable={
                    !isGettingLocation && !createPlaceMutation.isLoading
                  }
                />
                {errors.latitude && (
                  <Text style={styles.errorText}>{errors.latitude}</Text>
                )}
              </View>

              <View style={styles.coordInputGroup}>
                <Text style={styles.coordLabel}>{t("longitude")}</Text>
                <TextInput
                  style={[
                    styles.coordInput,
                    errors.longitude && styles.inputError,
                    (isGettingLocation || createPlaceMutation.isLoading) &&
                      styles.inputDisabled,
                  ]}
                  value={formData.longitude}
                  onChangeText={(text) => {
                    const newLng = parseFloat(text);
                    if (!isNaN(newLng) && newLng >= -180 && newLng <= 180) {
                      setCurrentCoords([newLng, lat]);
                    }
                    setFormData((prev) => ({ ...prev, longitude: text }));
                    if (errors.longitude)
                      setErrors((prev) => ({ ...prev, longitude: undefined }));
                  }}
                  placeholder="13.4050"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="decimal-pad"
                  editable={
                    !isGettingLocation && !createPlaceMutation.isLoading
                  }
                />
                {errors.longitude && (
                  <Text style={styles.errorText}>{errors.longitude}</Text>
                )}
              </View>
            </View>

            <View style={styles.coordsHint}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={Colors.textSecondary}
              />
              <Text style={styles.coordsHintText}>
                {t("coordinates_format_hint")}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Плавающая кнопка создания */}
      <View style={styles.floatingButtonContainer}>
        <Button
          mode="contained"
          onPress={handleCreatePlace}
          style={styles.createButton}
          loading={createPlaceMutation.isLoading}
          disabled={
            createPlaceMutation.isLoading ||
            isGettingLocation ||
            isMapInteracting
          }
          icon="add-circle-outline"
        >
          {t("create_place")}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};

const stylesFn = (Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.backgroundMain,
    },
    scrollView: {
      flex: 1,
    },
    mapSection: {
      height: 350,
      position: "relative",
    },
    map: {
      flex: 1,
    },
    markerContainer: {
      marginBottom: 40,
    },
    mapOverlay: {
      position: "absolute",
      top: 16,
      left: 16,
      right: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    mapHint: {
      fontSize: 14,
      color: Colors.white,
      backgroundColor: "rgba(0,0,0,0.7)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      overflow: "hidden",
    },
    locationButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      gap: 8,
    },
    locationButtonDisabled: {
      backgroundColor: Colors.textTertiary,
      opacity: 0.7,
    },
    locationButtonText: {
      color: Colors.white,
      fontSize: 14,
      fontWeight: "600",
    },
    formSection: {
      padding: 20,
      paddingTop: 24,
    },
    inputGroup: {
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
      marginBottom: 8,
    },
    required: {
      color: Colors.error,
    },
    input: {
      backgroundColor: Colors.inputBackground,
      borderWidth: 1,
      borderColor: Colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: Colors.textMain,
    },
    inputError: {
      borderColor: Colors.error,
    },
    inputDisabled: {
      backgroundColor: Colors.backgroundTertiary,
      color: Colors.textTertiary,
    },
    errorText: {
      fontSize: 12,
      color: Colors.error,
      marginTop: 4,
    },
    coordsSection: {
      backgroundColor: Colors.backgroundSecondary,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
    },
    coordsValue: {
      fontSize: 13,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      color: Colors.textSecondary,
      backgroundColor: Colors.backgroundTertiary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    coordsInputs: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    coordInputGroup: {
      flex: 1,
    },
    coordLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: Colors.textMain,
      marginBottom: 6,
    },
    coordInput: {
      backgroundColor: Colors.backgroundMain,
      borderWidth: 1,
      borderColor: Colors.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
      color: Colors.textMain,
      textAlign: "center",
    },
    coordsHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    coordsHintText: {
      flex: 1,
      fontSize: 12,
      color: Colors.textSecondary,
      lineHeight: 16,
    },
    floatingButtonContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 20,
      backgroundColor: Colors.backgroundMain,
      borderTopWidth: 1,
      borderTopColor: Colors.divider,
    },
    createButton: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    headerButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 8,
    },
  });

export default AddPlaceScreen;
