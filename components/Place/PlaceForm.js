import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../store/theme-context";
import Input from "../ui/Input";
import DropdownInput from "../ui/DropdownInput";
import { fetchCountries } from "../../util/fetches";
import { useLanguage } from "../../store/language-context";

const PlaceForm = ({
  onCoordsChange,
  formData,
  setFormData,
  coords,
  latText,
  lngText,
  setLatText,
  setLngText,
  errors,
  setErrors,
  locationDetails,
}) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const styles = stylesFn(Colors);
  const { language } = useLanguage();
  const [country, setCountry] = useState(null);

  //   console.log(locationDetails.countryCode)
  //   const countryValue =
  // countries.find(
  //   (c) => c.code.toLowerCase() === locationDetails.countryCode?.toLowerCase()
  // )?.value ?? null;

  // console.log(countryValue)

  const onChangeName = (text) => {
    setFormData((prev) => ({ ...prev, name: text }));
    setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const onChangeLat = (text) => {
    const sanitized = text.replace(",", ".");
    setLatText(sanitized);
    const newLat = parseFloat(sanitized);
    if (sanitized === "") {
      onCoordsChange([coords[0] ?? 0, null], { fromManual: true });
    } else if (!isNaN(newLat) && newLat >= -90 && newLat <= 90)
      onCoordsChange([coords[0] ?? 0, newLat], { fromManual: true });
    setErrors((prev) => ({ ...prev, latitude: undefined }));
  };

  const onChangeLng = (text) => {
    const sanitized = text.replace(",", ".");
    setLngText(sanitized);
    const newLng = parseFloat(sanitized);
    if (sanitized === "") {
      onCoordsChange([null, coords[1] ?? 0], { fromManual: true });
    } else if (!isNaN(newLng) && newLng >= -180 && newLng <= 180)
      onCoordsChange([newLng, coords[1] ?? 0], { fromManual: true });
    setErrors((prev) => ({ ...prev, longitude: undefined }));
  };

  return (
    <View style={styles.formSection}>
      <Input
        label={t("place_name")}
        value={formData.name}
        onUpdateValue={onChangeName}
        isInvalid={errors.name}
        error={errors.name}
      />

      <View style={styles.coordsContainer}>
        <View style={styles.coordInputWrapper}>
          <Input
            label={t("latitude")}
            value={latText}
            onUpdateValue={onChangeLat}
            keyboardType="numbers-and-punctuation"
            isInvalid={errors.latitude}
            error={errors.latitude}
          />
        </View>
        <View style={styles.coordInputWrapper}>
          <Input
            label={t("longitude")}
            value={lngText}
            onUpdateValue={onChangeLng}
            keyboardType="numbers-and-punctuation"
            isInvalid={errors.longitude}
            error={errors.longitude}
          />
        </View>
      </View>
      <DropdownInput
        title={t("country")}
        placeholder={t("select_country")}
        value={country}
        setValue={setCountry}
        error={errors?.territory}
        loadOptions={fetchCountries}
        loadDependencies={[language]}
      />

      {/* Детали */}
      {/* {locationDetails && (
        <View> */}
          {/* {locationDetails.country && (
            <DetailItem
              label={t("country")}
              value={locationDetails.country}
              icon="flag-outline"
            />
          )} */}
          {/* {locationDetails.address && (
            <DetailItem
              label={t("address")}
              value={locationDetails.address}
              icon="navigate-outline"
            />
          )} */}
        {/* </View>
      )} */}
    </View>
  );
};

export default PlaceForm;

const stylesFn = (Colors) =>
  StyleSheet.create({
    formSection: { padding: 16 },
    card: {
      // backgroundColor: Colors.primary200,
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
    coordsContainer: { flexDirection: "row", gap: 12 },
    coordInputWrapper: { flex: 1 },
  });

const DetailItem = ({ label, value, icon }) => {
  const { Colors } = useTheme();
  const styles = detailStyles(Colors);
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={16} color={Colors.textSecondary} />
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
