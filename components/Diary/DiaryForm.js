import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

import DropdownInput from "../ui/DropdownInput";
import DateInput from "../ui/DateInput";
import { fetchMyCountries, fetchMyPlaces } from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import Input from "../ui/Input";
import Section from "../ui/Section";
import PrivacyToggle from "../ui/PrivacyToggle";
import PlaceBlock from "../Place/PlaceBlock";
import { usePlaceLocation } from "../../hooks/Place/usePlaceLocation";
import { useSortedQuery } from "../../hooks/useSortedQuery";

const DiaryForm = ({
  formData,
  setFormData,
  errors,
  setErrors,
  territoryValue,
  setTerritoryValue,
  placeValue,
  setPlaceValue,
  onAddNewPlace,
  placeData,
  setPlaceData,
  isEditMode,
}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { coords, roundedCoords, isLocating } = usePlaceLocation();

  const {
    query: queryMyCountries,
    sort: countriesSort,
    onSortChange: onCountriesSortChange,
  } = useSortedQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
  });

  const {
    query: queryPlaces,
    sort: placesSort,
    onSortChange: onPlacesSortChange,
  } = useSortedQuery({
    type: "PlacesDropdown",
    queryFn: (sort) => fetchMyPlaces(territoryValue, coords, sort),
    params: [territoryValue, roundedCoords],
    enabled: !!territoryValue,
  });

  return (
    <ScrollView
      contentContainerStyle={{ padding: 12 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Section title={t("section_main")} required collapsible={true}>
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
          disabled={isEditMode}
        />

        <DateInput
          value={formData.date_time}
          onChange={(newDate) => {
            setFormData((prev) => ({ ...prev, date_time: newDate }));
            setErrors((prev) => ({ ...prev, date_time: undefined }));
          }}
          placeholder={t("diary_date")}
          error={errors.date_time}
          allowClear={false}
          style={{ marginBottom: 16 }}
        />

        <Input
          value={formData.name}
          onUpdateValue={(val) =>
            setFormData((prev) => ({ ...prev, name: val }))
          }
          error={errors.name}
          isInvalid={errors.name}
          icon="document-text-outline"
          placeholder={t("add_a_note")}
          multiline
        />

        <PrivacyToggle
          value={formData.private}
          onChange={(val) => setFormData((prev) => ({ ...prev, private: val }))}
          diary={true}
        />
      </Section>

      {/* ── 3. Optional: Where ───────────────────────────────── */}
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
    </ScrollView>
  );
};

export default DiaryForm;
