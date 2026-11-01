import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme, ThemeColors } from "../../store/theme-context";
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
  // Fired when the lat/lng inputs open, by a tap or by a coordinate error.
  onCoordsExpand?: () => void;
}

// Lives in PlaceEditorScreen's form sheet, hence the sheet-aware inputs.
// Placeholders instead of labels, as in the observation/diary forms, so the
// whole form fits the sheet's resting height. The coordinates are usually set
// by a tap on the map, so by default they are one summary row; the lat/lng
// inputs open on a tap on it (or on a coordinate validation error).
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
  onCoordsExpand,
}: PlaceFormProps) => {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { language } = useLanguage();

  const [territory, setTerritory] = useState<string | number | null>(null);
  const [coordsExpanded, setCoordsExpanded] = useState(false);

  const hasCoordsError = !!errors.latitude || !!errors.longitude;

  // Opened by the error, not kept open by it: deriving visibility from the
  // error would fold the inputs away mid-typing, the moment a keystroke
  // makes the value valid and clears the error.
  useEffect(() => {
    if (!hasCoordsError) return;
    setCoordsExpanded(true);
    onCoordsExpand?.();
  }, [hasCoordsError]);

  const toggleCoords = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!coordsExpanded) onCoordsExpand?.();
    setCoordsExpanded(!coordsExpanded);
  };

  const coordsSummary =
    latText && lngText ? `${latText}, ${lngText}` : null;

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
        placeholder={t("place_name")}
        value={formData.name}
        onUpdateValue={onChangeName}
        isInvalid={!!errors.name}
        error={errors.name}
        testID="place-name-input"
        inBottomSheet
      />

      <DropdownInput
        placeholder={t("select_country")}
        value={territory}
        setValue={onChangeTerritory}
        query={queryMyCountries}
        error={errors?.territory}
        type="CountriesDropdown"
        sort={countriesSort}
        onSortChange={onCountriesSortChange}
      />

      <Pressable
        onPress={toggleCoords}
        style={[styles.coordsRow, hasCoordsError && styles.coordsRowInvalid]}
        accessibilityRole="button"
        accessibilityState={{ expanded: coordsExpanded }}
        testID="place-coords-toggle"
      >
        <Ionicons
          name="location-outline"
          size={16}
          color={Colors.textSecondary}
        />
        <Text
          style={[styles.coordsText, !coordsSummary && styles.coordsPlaceholder]}
          numberOfLines={1}
          testID="place-coords-summary"
        >
          {coordsSummary ?? t("coordinates")}
        </Text>
        <Ionicons
          name={coordsExpanded ? "chevron-up" : "create-outline"}
          size={18}
          color={Colors.main100}
        />
      </Pressable>

      {coordsExpanded && (
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
              inBottomSheet
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
              inBottomSheet
            />
          </View>
        </View>
      )}
    </View>
  );
};

export default PlaceForm;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    formSection: { paddingHorizontal: 16, paddingTop: 12 },
    // Same box as the Input/DropdownInput triggers above it.
    coordsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 40,
      marginBottom: 16,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderRadius: 4,
      borderColor: Colors.border,
      backgroundColor: Colors.primary100,
    },
    coordsRowInvalid: { borderColor: Colors.error500 },
    coordsText: { flex: 1, fontSize: 16, color: Colors.textMain },
    coordsPlaceholder: { color: Colors.textSecondary },
    coordsContainer: { flexDirection: "row", gap: 12 },
    coordInputWrapper: { flex: 1 },
  });
