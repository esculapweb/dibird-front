import { useEffect } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

import DropdownInput from "../ui/DropdownInput";
import DateInput from "../ui/DateInput";
import TimeInput from "../ui/TimeInput";
import {
  fetchMyCountries,
  fetchMyPlaces,
  fetchSpecies,
} from "../../util/fetches";
import { useTranslatedQuery } from "../../hooks/useQueryWithTranslation";
import { useLanguage } from "../../store/language-context";
import SpeciesOptionRow from "../ui/SpeciesOptionRow";
import Input from "../ui/Input";
import Section from "../ui/Section";
import PrivacyToggle from "../ui/PrivacyToggle";
import PlaceBlock from "../Place/PlaceBlock";
import { usePlaceLocation } from "../../hooks/Place/usePlaceLocation";

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
}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { coords, roundedCoords, isLocating } = usePlaceLocation();

  const queryTerritories = useTranslatedQuery({
    queryFn: () => fetchMyCountries(false),
    params: [language],
    type: "Mycountries",
  });

  const queryPlaces = useTranslatedQuery({
    queryFn: () => fetchMyPlaces(territoryValue, coords),
    params: [territoryValue, roundedCoords],
    type: "Places",
    enabled: !!territoryValue,
  });

  const querySpecies = useTranslatedQuery({
    queryFn: () => fetchSpecies(territoryValue),
    params: [territoryValue],
    type: "Species",
    enabled: !!territoryValue,
  });

  useEffect(() => {
    if (!querySpecies.data || !speciesValue) return;

    const speciesExists = querySpecies.data.some(
      (item) => item.value === speciesValue,
    );
    if (!speciesExists) setSpeciesValue(null);
  }, [querySpecies.data]);

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
          query={queryTerritories}
          error={errors.territory}
          label={t("country")}
        />

        <DropdownInput
          placeholder={t("select_species")}
          value={speciesValue}
          setValue={(val) => {
            setSpeciesValue(val);
            setFormData((prev) => ({ ...prev, species: val }));
            setErrors((prev) => ({ ...prev, species: undefined }));
            const found = querySpecies.data?.find((item) => item.value === val);
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
            />
          )}
          speciesData={speciesData}
        />

        <DateInput
          value={formData.date_time}
          onChange={(newDate) => {
            setFormData((prev) => ({ ...prev, date_time: newDate }));
            setErrors((prev) => ({ ...prev, date_time: undefined }));
          }}
          placeholder={t("observation_date")}
          error={errors.date_time}
          allowClear={false}
          style={{ marginTop: 16 }}
        />
      </Section>

      {/* ── 3. Optional: Where ───────────────────────────────── */}
      <Section
       title={t("section_where")} 
       hint={t("optional")} 
       collapsible={!!placeValue}
       collapsed={!placeValue}>
        <PlaceBlock
          territoryValue={territoryValue}
          placeValue={placeValue}
          setPlaceValue={setPlaceValue}
          setFormData={setFormData}
          onAddNewPlace={onAddNewPlace}
          queryPlaces={queryPlaces}
          isLocating={isLocating}
        />
      </Section>

      {/* ── 4. Optional: Details ─────────────────────────────── */}
      <Section title={t("section_details")} hint={t("optional")} collapsed>
        <TimeInput
          value={formData.time}
          onChange={(newTime) =>
            setFormData((prev) => ({ ...prev, time: newTime }))
          }
        />
        <Input
          label={t("quantity")}
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
        />

        <Input
          label={t("notes")}
          value={formData.notes}
          onUpdateValue={(val) =>
            setFormData((prev) => ({ ...prev, notes: val }))
          }
          error={errors.notes}
          isInvalid={errors.notes}
          ƒ
          multiline
        />
      </Section>

      {/* ── 5. Required: Privacy ─────────────────────────────── */}
      <Section title={t("section_privacy")}>
        <PrivacyToggle
          value={formData.private}
          onChange={(val) => setFormData((prev) => ({ ...prev, private: val }))}
        />
      </Section>
    </ScrollView>
  );
};

export default ObservationForm;
