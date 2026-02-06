// components/Place/EditPlaceModal.js
import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";
import ModalWrapper from "../ui/ModalWrapper";
import EditableMap from "../Map/EditableMap";

const EditPlaceModal = ({ visible, place, onClose, onSave, isLoading }) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);

  // Состояние формы
  const [formData, setFormData] = useState({
    name: "",
    latitude: "",
    longitude: "",
  });
  const [errors, setErrors] = useState({});
  const [isMapInteracting, setIsMapInteracting] = useState(false);

  // Инициализация данных при открытии модалки
  useEffect(() => {
    if (place) {
      const [lng, lat] = place.location.coordinates;
      setFormData({
        name: place.name,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      });
      setErrors({});
    }
  }, [place, visible]);

  // Валидация формы
  const validateForm = () => {
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
  };

  // Обработчик сохранения
  const handleSave = () => {
    if (!validateForm()) return;

    const updateData = {
      name: formData.name.trim(),
      location: {
        type: "Point",
        coordinates: [
          parseFloat(formData.longitude),
          parseFloat(formData.latitude),
        ],
      },
    };

    onSave(updateData);
  };

  // Обработчик изменения координат через карту
  const handleMapCoordinateChange = ([lng, lat]) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
    setErrors((prev) => ({
      ...prev,
      latitude: undefined,
      longitude: undefined,
    }));
  };

  // Обработчик сброса к исходным значениям
  const handleReset = () => {
    if (place) {
      const [lng, lat] = place.location.coordinates;
      setFormData({
        name: place.name,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      });
      setErrors({});
    }
  };

  const lat = parseFloat(formData.latitude) || 0;
  const lng = parseFloat(formData.longitude) || 0;

  return (
    <ModalWrapper
      visible={visible}
      onClose={onClose}
      title={t("edit_place")}
      onApply={onSave}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Название места - в самом верху */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("place_name")}</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={formData.name}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, name: text }))
              }
              placeholder={t("enter_place_name")}
              maxLength={100}
              editable={!isLoading}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Большая карта для выбора координат */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("coordinates")}</Text>
              <TouchableOpacity onPress={handleReset} disabled={isLoading}>
                <Text style={styles.resetButton}>{t("reset")}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>{t("tap_map_to_change")}</Text>

            {/* Большая интерактивная карта */}
            <View style={styles.mapContainer}>
              <EditableMap
                coordinates={[lng, lat]}
                onCoordinateChange={handleMapCoordinateChange}
                editable={!isLoading}
                fullScreen={true}
                onRegionWillChange={() => setIsMapInteracting(true)}
                onRegionDidChange={() => setIsMapInteracting(false)}
              />
            </View>

            {/* Текущие координаты */}
            <View style={styles.currentCoords}>
              <Ionicons
                name="navigate-outline"
                size={16}
                color={Colors.textSecondary}
              />
              <Text style={styles.coordsText}>
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </Text>
            </View>

            {/* Поля ввода координат вручную */}
            <View style={styles.coordsInputs}>
              <View style={styles.coordInputContainer}>
                <Text style={styles.coordLabel}>{t("latitude")}</Text>
                <TextInput
                  style={[
                    styles.coordInput,
                    errors.latitude && styles.inputError,
                  ]}
                  value={formData.latitude}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, latitude: text }))
                  }
                  placeholder="52.5200"
                  keyboardType="decimal-pad"
                  editable={!isLoading}
                />
                {errors.latitude && (
                  <Text style={styles.errorText}>{errors.latitude}</Text>
                )}
              </View>

              <View style={styles.coordInputContainer}>
                <Text style={styles.coordLabel}>{t("longitude")}</Text>
                <TextInput
                  style={[
                    styles.coordInput,
                    errors.longitude && styles.inputError,
                  ]}
                  value={formData.longitude}
                  onChangeText={(text) =>
                    setFormData((prev) => ({ ...prev, longitude: text }))
                  }
                  placeholder="13.4050"
                  keyboardType="decimal-pad"
                  editable={!isLoading}
                />
                {errors.longitude && (
                  <Text style={styles.errorText}>{errors.longitude}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Подсказка */}
          <View style={styles.hintBox}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={Colors.textSecondary}
              style={styles.hintIcon}
            />
            <Text style={styles.hintText}>{t("coordinates_hint")}</Text>
          </View>
        </ScrollView>

      </KeyboardAvoidingView>
    </ModalWrapper>
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
      paddingHorizontal: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: Colors.textMain,
      marginBottom: 8,
    },
    input: {
      backgroundColor: Colors.inputBackground,
      borderWidth: 1,
      borderColor: Colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 14,
      fontSize: 16,
      color: Colors.textMain,
    },
    inputError: {
      borderColor: Colors.error,
    },
    errorText: {
      fontSize: 12,
      color: Colors.error,
      marginTop: 4,
    },
    hint: {
      fontSize: 13,
      color: Colors.textSecondary,
      marginBottom: 8,
      textAlign: "center",
    },
    mapContainer: {
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 12,
      // Тень для карты
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
    },
    currentCoords: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
      paddingVertical: 8,
      backgroundColor: Colors.backgroundSecondary,
      borderRadius: 8,
    },
    coordsText: {
      marginLeft: 8,
      fontSize: 14,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      color: Colors.textMain,
      fontWeight: "500",
    },
    coordsInputs: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 8,
    },
    coordInputContainer: {
      flex: 1,
    },
    coordLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: Colors.textMain,
      marginBottom: 6,
    },
    coordInput: {
      backgroundColor: Colors.inputBackground,
      borderWidth: 1,
      borderColor: Colors.inputBorder,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
      color: Colors.textMain,
      textAlign: "center",
    },
    hintBox: {
      flexDirection: "row",
      backgroundColor: Colors.backgroundSecondary,
      padding: 12,
      borderRadius: 8,
      marginBottom: 24,
    },
    hintIcon: {
      marginRight: 8,
      marginTop: 2,
    },
    hintText: {
      flex: 1,
      fontSize: 13,
      color: Colors.textSecondary,
      lineHeight: 18,
    },
    resetButton: {
      fontSize: 14,
      color: Colors.primary,
      fontWeight: "500",
    },
    buttons: {
      flexDirection: "row",
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: Colors.divider,
      gap: 12,
    },
    button: {
      flex: 1,
    },
  });

export default EditPlaceModal;