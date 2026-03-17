import { useEffect } from "react";
import { ScrollView, Text, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import DropdownInput from "../ui/DropdownInput";
import DateInput from "../ui/DateInput";
import TimeInput from "../ui/TimeInput";
import {
  fetchMyCountries,
  fetchMyPlaces,
  fetchSpecies,
} from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import SpeciesOptionRow from "../ui/SpeciesOptionRow";
import Input from "../ui/Input";
import Section from "../ui/Section";
import PrivacyToggle from "../ui/PrivacyToggle";
import PlaceBlock from "../Place/PlaceBlock";
import { usePlaceLocation } from "../../hooks/Place/usePlaceLocation";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { useTheme } from "../../store/theme-context";
import FlatButtonBottom from "../ui/FlatButtonBottom";

const ObservationForm = ({
  formData,
  setFormData,
  errors,
  setErrors,
  territoryValue,
  setTerritoryValue,
  speciesValue,
  setSpeciesValue,
  placeValue,
  setPlaceValue,
  onAddNewPlace,
  speciesData,
  setSpeciesData,
  placeData,
  setPlaceData,
  isDiaryMode = false,
  isEditMode = false,
  onEditDiary,
  onSaveAndAddAnother,
  isSaving,
  justSaved,
  existingSpecies,
}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { Colors } = useTheme();
  const { coords, roundedCoords, isLocating } = usePlaceLocation();

  const isDiaryCreate = isDiaryMode && !isEditMode;
  const isDiaryEdit = isDiaryMode && isEditMode;
  const hideDiaryFields = isDiaryCreate || isDiaryEdit;

  const {
    query: queryMyCountries,
    sort: countriesSort,
    onSortChange: onCountriesSortChange,
  } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
    enabled: !hideDiaryFields,
  });

  const {
    query: queryPlaces,
    sort: placesSort,
    onSortChange: onPlacesSortChange,
  } = useDropdownQuery({
    type: "PlacesDropdown",
    queryFn: (sort) => fetchMyPlaces(territoryValue, coords, sort),
    params: [territoryValue, roundedCoords],
    enabled: !!territoryValue && !hideDiaryFields,
  });

  const {
    query: querySpecies,
    sort: speciesSort,
    onSortChange: onSpeciesSortChange,
  } = useDropdownQuery({
    type: "SpeciesDropdown",
    queryFn: (sort) => fetchSpecies(territoryValue, sort),
    params: [territoryValue, language],
    enabled: !!territoryValue,
  });

  useEffect(() => {
    if (!querySpecies.data || !speciesValue) return;
    const speciesExists = querySpecies.data.some(
      (item) => item.value === speciesValue,
    );
    if (!speciesExists) setSpeciesValue(null);
  }, [querySpecies.data]);

  const DiaryBanner = () => (
    <Pressable
      onPress={onEditDiary}
      style={[
        styles.diaryBanner,
        {
          backgroundColor: Colors.primary300,
          borderColor: Colors.border,
        },
      ]}
    >
      <View style={styles.diaryBannerLeft}>
        <View style={styles.diaryBannerTop}>
          <Ionicons
            name="book-outline"
            size={15}
            color={Colors.textSecondary}
          />
          <Text style={[styles.diaryBannerText, { color: Colors.textMain }]}>
            {t("diary_fields_hint")}
          </Text>
        </View>
        <View style={styles.diaryBannerFields}>
          <View style={styles.diaryBannerField}>
            <Ionicons
              name="flag-outline"
              size={12}
              color={Colors.textSecondary}
            />
            <Text
              style={[
                styles.diaryBannerFieldText,
                { color: Colors.textSecondary },
              ]}
            >
              {t("country")}
            </Text>
          </View>
          <View style={styles.diaryBannerField}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color={Colors.textSecondary}
            />
            <Text
              style={[
                styles.diaryBannerFieldText,
                { color: Colors.textSecondary },
              ]}
            >
              {t("date")}
            </Text>
          </View>
          <View style={styles.diaryBannerField}>
            <Ionicons
              name="location-outline"
              size={12}
              color={Colors.textSecondary}
            />
            <Text
              style={[
                styles.diaryBannerFieldText,
                { color: Colors.textSecondary },
              ]}
            >
              {t("place")}
            </Text>
          </View>
          <View style={styles.diaryBannerField}>
            <Ionicons
              name="lock-closed-outline"
              size={12}
              color={Colors.textSecondary}
            />
            <Text
              style={[
                styles.diaryBannerFieldText,
                { color: Colors.textSecondary },
              ]}
            >
              {t("privacy")}
            </Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={15} color={Colors.textSecondary} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Section
          title={t("section_main")}
          required
          collapsible={!hideDiaryFields}
        >
          {!hideDiaryFields && (
            <DropdownInput
              placeholder={t("select_country")}
              value={territoryValue}
              setValue={(val) => {
                setTerritoryValue(val);
                setFormData((prev) => ({ ...prev, territory: val }));
                setErrors((prev) => ({ ...prev, territory: undefined }));
                setPlaceValue(null);
              }}
              query={queryMyCountries}
              error={errors.territory}
              label={t("country")}
              type="CountriesDropdown"
              sort={countriesSort}
              onSortChange={onCountriesSortChange}
            />
          )}

          <DropdownInput
            placeholder={t("select_species")}
            value={speciesValue}
            setValue={(val) => {
              setSpeciesValue(val);
              setFormData((prev) => ({ ...prev, species: val }));
              setErrors((prev) => ({ ...prev, species: undefined }));
              const found = querySpecies.data?.find(
                (item) => item.value === val,
              );
              setSpeciesData(found ?? null);
            }}
            query={querySpecies}
            disabled={!territoryValue}
            error={errors.species}
            hidden
            renderOption={({ item, selected, onSelect, onClose }) => (
              <SpeciesOptionRow
                item={item}
                selected={selected}
                onSelect={onSelect}
                onClose={onClose}
                disabled={existingSpecies?.has(item.value)}
              />
            )}
            speciesData={speciesData}
            type="SpeciesDropdown"
            sort={speciesSort}
            onSortChange={onSpeciesSortChange}
          />

          {!hideDiaryFields && (
            <DateInput
              value={formData.date_time}
              onChange={(newDate) => {
                setFormData((prev) => ({ ...prev, date_time: newDate }));
                setErrors((prev) => ({ ...prev, date_time: undefined }));
              }}
              placeholder={t("observation_date")}
              error={errors.date_time}
              allowClear={false}
              style={{ marginVertical: 16 }}
            />
          )}

          {!hideDiaryFields && (
            <PrivacyToggle
              value={formData.private}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, private: val }))
              }
            />
          )}
        </Section>

        {!hideDiaryFields && (
          <Section
            title={t("section_where")}
            hint={t("optional")}
            collapsible={true}
          >
            <PlaceBlock
              territoryValue={territoryValue}
              placeValue={placeValue}
              setPlaceValue={setPlaceValue}
              setFormData={setFormData}
              onAddNewPlace={onAddNewPlace}
              queryPlaces={queryPlaces}
              isLocating={isLocating}
              sort={placesSort}
              onSortChange={onPlacesSortChange}
              placeData={placeData}
              setPlaceData={setPlaceData}
            />
          </Section>
        )}

        <Section
          title={t("section_details")}
          hint={t("optional")}
          collapsible={true}
          collapsed={
            !formData.time && formData.quantity == null && !formData.notes
          }
        >
          <TimeInput
            value={formData.time}
            onChange={(newTime) =>
              setFormData((prev) => ({ ...prev, time: newTime }))
            }
          />
          <Input
            value={
              formData?.quantity != null ? formData.quantity.toString() : null
            }
            keyboardType="numeric"
            onUpdateValue={(val) =>
              setFormData((prev) => ({
                ...prev,
                quantity: val?.trim() === "" ? null : val.trim(),
              }))
            }
            error={errors.quantity}
            isInvalid={errors.quantity}
            placeholder={t("quantity_placeholder")}
            birdSvg
          />
          <Input
            value={formData.notes}
            onUpdateValue={(val) =>
              setFormData((prev) => ({ ...prev, notes: val }))
            }
            error={errors.notes}
            isInvalid={errors.notes}
            icon="document-text-outline"
            placeholder={t("add_a_note")}
            multiline
          />
        </Section>
        {isDiaryEdit && <DiaryBanner />}
      </ScrollView>
      {onSaveAndAddAnother && (
        <FlatButtonBottom
          onPress={onSaveAndAddAnother}
          icon="add-outline"
          loading={isSaving}
          savedLabel={justSaved ? t("observation_added") : null}
        >
          {t("save_and_add_another")}
        </FlatButtonBottom>
      )}
    </View>
  );
};

export default ObservationForm;

const styles = StyleSheet.create({
  diaryBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  diaryBannerLeft: {
    flex: 1,
  },
  diaryBannerText: {
    fontSize: 13,
    flex: 1,
  },
  diaryBannerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  diaryBannerFields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  diaryBannerField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  diaryBannerFieldText: {
    fontSize: 11,
  },
});
