import { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../store/theme-context";
import Input from "../ui/Input";
import DropdownInput from "../ui/DropdownInput";
import { fetchCountries } from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import { useTranslatedQuery } from "../../hooks/useQueryWithTranslation";

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

  const [territory, setTerritory] = useState(null);

  const queryTerritories = useTranslatedQuery({
    queryFn: fetchCountries,
    params: [language],
    type: 'countries',
  });

  const territories = queryTerritories.data ?? [];

  useEffect(() => {
    if (!territories.length || !locationDetails?.countryCode) return;

    const countryValue = territories.find(
      (c) => c.code.toLowerCase() === locationDetails.countryCode.toLowerCase(),
    )?.value;

    if (countryValue) {
      setTerritory(countryValue);
      setFormData((prev) => ({ ...prev, territory: countryValue }));
      setErrors((prev) => ({ ...prev, territory: undefined }));
    }
  }, [territories, locationDetails?.countryCode, coords]);

  const onChangeName = (text) => {
    setFormData((prev) => ({ ...prev, name: text }));
    setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const onChangeLat = (text) => {
    const sanitized = text.replace(",", ".");
    setLatText(sanitized);
    onCoordsChange([lngText, sanitized], { fromManual: true });
  };

  const onChangeLng = (text) => {
    const sanitized = text.replace(",", ".");
    setLngText(sanitized);
    onCoordsChange([sanitized, latText], { fromManual: true });
  };

  const onChangeTerritory = (value) => {
    setTerritory(value);
    setFormData((prev) => ({ ...prev, territory: value }));
    setErrors((prev) => ({ ...prev, territory: undefined }));
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
        value={territory}
        setValue={onChangeTerritory}
        query={queryTerritories}
        error={errors?.territory}
      />
    </View>
  );
};

export default PlaceForm;

const stylesFn = (Colors) =>
  StyleSheet.create({
    formSection: { padding: 16 },
    coordsContainer: { flexDirection: "row", gap: 12 },
    coordInputWrapper: { flex: 1 },
  });
