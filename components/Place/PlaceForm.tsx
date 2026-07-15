import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Input from "../ui/Input";
import DropdownInput from "../ui/DropdownInput";
import { fetchMyCountries } from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { Coords, PlaceFormData, ReverseGeocode } from "../../types";

interface Errors {
  name?: string;
  latitude?: string;
  longitude?: string;
  territory?: string;
}

interface PlaceFormProps {
  onCoordsChange: (
    coords: [string, string],
    options?: { fromManual?: boolean },
  ) => void;
  formData: PlaceFormData;
  setFormData: Dispatch<SetStateAction<PlaceFormData>>;
  coords: Coords | null;
  latText: string;
  lngText: string;
  setLatText: (value: string) => void;
  setLngText: (value: string) => void;
  errors: Errors;
  setErrors: Dispatch<SetStateAction<Errors>>;
  locationDetails?: ReverseGeocode | null;
  isEditMode?: boolean;
}

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
  isEditMode,
}: PlaceFormProps) => {
  const { t } = useTranslation();
  const styles = stylesFn();
  const { language } = useLanguage();

  const [territory, setTerritory] = useState<string | number | null>(null);

  const {
    query: queryMyCountries,
    sort: countriesSort,
    onSortChange: onCountriesSortChange,
  } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
  });

  const territories = queryMyCountries.data ?? [];

  // Editing an existing place already knows its territory from the saved
  // record — seed the dropdown from it directly rather than waiting on a
  // reverse-geocode of the current pin, which needs network and would
  // otherwise leave the field blank offline (or silently override a
  // manually-corrected territory once it does resolve).
  useEffect(() => {
    if (isEditMode && formData.territory) {
      setTerritory(formData.territory);
    }
  }, [isEditMode, formData.territory]);

  useEffect(() => {
    if (isEditMode) return;
    const countryCode = locationDetails?.country_code;
    if (!territories.length || !countryCode) return;

    const countryValue = territories.find(
      (c) => c.code.toLowerCase() === countryCode.toLowerCase(),
    )?.value;

    if (countryValue) {
      setTerritory(countryValue);
      setFormData((prev) => ({ ...prev, territory: Number(countryValue) }));
      setErrors((prev) => ({ ...prev, territory: undefined }));
    }
  }, [territories, locationDetails?.country_code, coords]);

  const onChangeName = (text: string) => {
    setFormData((prev) => ({ ...prev, name: text }));
    setErrors((prev) => ({ ...prev, name: undefined }));
  };

  const onChangeLat = (text: string) => {
    const sanitized = text.replace(",", ".");
    setLatText(sanitized);
    onCoordsChange([lngText, sanitized], { fromManual: true });
  };

  const onChangeLng = (text: string) => {
    const sanitized = text.replace(",", ".");
    setLngText(sanitized);
    onCoordsChange([sanitized, latText], { fromManual: true });
  };

  const onChangeTerritory = (value: string | number | null) => {
    setTerritory(value);
    setFormData((prev) => ({ ...prev, territory: Number(value) }));
    setErrors((prev) => ({ ...prev, territory: undefined }));
  };

  return (
    <View style={styles.formSection}>
      <Input
        label={t("place_name")}
        value={formData.name}
        onUpdateValue={onChangeName}
        isInvalid={!!errors.name}
        error={errors.name}
        testID="place-name-input"
      />

      <View style={styles.coordsContainer}>
        <View style={styles.coordInputWrapper}>
          <Input
            label={t("latitude")}
            value={latText}
            onUpdateValue={onChangeLat}
            keyboardType="numbers-and-punctuation"
            isInvalid={!!errors.latitude}
            error={errors.latitude}
            testID="latitude-input"
          />
        </View>
        <View style={styles.coordInputWrapper}>
          <Input
            label={t("longitude")}
            value={lngText}
            onUpdateValue={onChangeLng}
            keyboardType="numbers-and-punctuation"
            isInvalid={!!errors.longitude}
            error={errors.longitude}
            testID="longitude-input"
          />
        </View>
      </View>

      <DropdownInput
        title={t("country")}
        placeholder={t("select_country")}
        value={territory}
        setValue={onChangeTerritory}
        query={queryMyCountries}
        error={errors?.territory}
        type="CountriesDropdown"
        sort={countriesSort}
        onSortChange={onCountriesSortChange}
      />
    </View>
  );
};

export default PlaceForm;

const stylesFn = () =>
  StyleSheet.create({
    formSection: { padding: 16, marginBottom: 8 },
    coordsContainer: { flexDirection: "row", gap: 12 },
    coordInputWrapper: { flex: 1 },
  });
