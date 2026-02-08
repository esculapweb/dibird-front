import { useState, useEffect } from "react";
import { StyleSheet, Text, View, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../store/theme-context";
import { Config } from "../../constants/config";

const PlaceForm = ({
  onCoordsChange,
  formData,
  setFormData,
  coords,
  errors,
  setErrors,
  locationDetails,
}) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);
  const defaultCoords = Config.defaultCoords;

  const [latText, setLatText] = useState(coords ? coords[1].toString() : "");
  const [lngText, setLngText] = useState(coords ? coords[0].toString() : "");

  useEffect(() => {
    if (coords) {
      setLatText(coords[1].toString());
      setLngText(coords[0].toString());
    }
  }, [coords]);

  const onChangeName = (text) => {
    setFormData((prev) => ({ ...prev, name: text }));
    setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const onChangeLat = (text) => {
    setLatText(text);
    const newLat = parseFloat(text);
    if (!isNaN(newLat) && newLat >= -90 && newLat <= 90)
      onCoordsChange?.([coords[0] ?? 0, newLat]);
    setErrors((prev) => ({ ...prev, latitude: undefined }));
  };

  const onChangeLng = (text) => {
    setLngText(text);
    const newLng = parseFloat(text);
    if (!isNaN(newLng) && newLng >= -180 && newLng <= 180)
      onCoordsChange?.([newLng, coords[1] ?? 0]);
    setErrors((prev) => ({ ...prev, longitude: undefined }));
  };

  return (
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
          onChangeText={onChangeName}
          placeholder={t("enter_place_name")}
          placeholderTextColor={Colors.dropdownIcon}
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
              style={[styles.coordInput, errors.latitude && styles.inputError]}
              value={latText}
              onChangeText={onChangeLat}
              placeholder={defaultCoords[1]}
              placeholderTextColor={Colors.dropdownIcon}
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
              style={[styles.coordInput, errors.longitude && styles.inputError]}
              value={lngText}
              onChangeText={onChangeLng}
              placeholder={defaultCoords[0]}
              placeholderTextColor={Colors.dropdownIcon}
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
  );
};

export default PlaceForm;

const stylesFn = (Colors) =>
  StyleSheet.create({
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
    },
  });

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
