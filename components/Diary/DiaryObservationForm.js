import { useEffect } from "react";
import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

import DropdownInput from "../ui/DropdownInput";
import TimeInput from "../ui/TimeInput";
import { fetchSpecies } from "../../util/fetches";
import SpeciesOptionRow from "../ui/SpeciesOptionRow";
import Input from "../ui/Input";
import Section from "../ui/Section";
import { useSortedQuery } from "../../hooks/useSortedQuery";

const DiaryObservationForm = ({
  formData,
  setFormData,
  errors,
  setErrors,
  territoryValue,
  speciesValue,
  setSpeciesValue,
  speciesData,
  setSpeciesData,
}) => {
  const { t } = useTranslation();

  const {
    query: querySpecies,
    sort: speciesSort,
    onSortChange: onSpeciesSortChange,
  } = useSortedQuery({
    type: "SpeciesDropdown",
    queryFn: (sort) => fetchSpecies(territoryValue, sort),
    params: [territoryValue],
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
      <Section title={t("species_single")} required >       

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
          type="SpeciesDropdown"
          sort={speciesSort}
          onSortChange={onSpeciesSortChange}
        />
        
      </Section>     

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
    </ScrollView>
  );
};

export default DiaryObservationForm;
