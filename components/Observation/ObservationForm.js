import { View, StyleSheet, Switch, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../store/theme-context";
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
}) => {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const { language } = useLanguage();

  const queryTerritories = useTranslatedQuery({
    queryFn: () => fetchMyCountries(false),
    params: [language],
    type: "Mycountries",
  });

  const queryPlaces = useTranslatedQuery({
    queryFn: () => fetchMyPlaces(territoryValue),
    params: [territoryValue],
    type: "Places",
    enabled: !!territoryValue,
  });

  const querySpecies = useTranslatedQuery({
    queryFn: () => fetchSpecies(territoryValue),
    params: [territoryValue],
    type: "Species",
    enabled: !!territoryValue,
  });

  return (
    <View style={styles.formContainer}>
      {/* Страна */}
      <DropdownInput
        title={t("country")}
        placeholder={t("select_country")}
        value={territoryValue}
        setValue={(val) => {
          setTerritoryValue(val);
          setFormData((prev) => ({ ...prev, territory: val }));
          setErrors((prev) => ({ ...prev, territory: undefined }));
          setPlaceValue(null); // сброс места при смене страны
        }}
        query={queryTerritories}
        error={errors.territory}
      />

      {/* Вид */}
      <DropdownInput
        title={t("species")}
        placeholder={t("select_species")}
        value={speciesValue}
        setValue={(val) => {
          setSpeciesValue(val);
          setFormData((prev) => ({ ...prev, species: val }));
          setErrors((prev) => ({ ...prev, species: undefined }));
        }}
        query={querySpecies}
        disabled={!territoryValue}
        disabledMessage={t("select_country_first")}
        error={errors.species}
        renderOption={({ item, selected, onSelect, onClose }) => (
          <SpeciesOptionRow
            item={item}
            selected={selected}
            onSelect={onSelect}
            onClose={onClose}
          />
        )}
      />

      {/* Место */}
      <DropdownInput
        title={t("location")}
        placeholder={t("select_location")}
        value={placeValue}
        setValue={(val) => {
          setPlaceValue(val);
          setFormData((prev) => ({ ...prev, place: val }));
        }}
        query={queryPlaces}
        allowReset
        disabled={!territoryValue}
        disabledMessage={t("select_country_first")}
      />
      <Text
        style={{ color: Colors.link, marginTop: 4 }}
        onPress={() => onAddNewPlace((newPlace) => setPlaceValue(newPlace))}
      >
        {t("add_new_location")}
      </Text>

      <DateInput
        label={t("observation_date")}
        value={formData.date_time}
        onChange={(newDate) =>
          setFormData((prev) => ({ ...prev, date_time: newDate }))
        }
        placeholder={t("not_selected")}
        error={errors.date_time}
        allowClear={false}
      />

      <TimeInput
        label={t("observation_time")}
        value={formData.time}
        onChange={(newTime) => setFormData((prev) => ({ ...prev, time: newTime }))}
      />

      <Input
        label={t("quantity")}
        value={
          formData?.quantity != null ? formData?.quantity.toString() : null
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
      

      {/* Примечания */}
      <Input
        label={t("notes")}
        value={formData.notes}
        onUpdateValue={(val) => setFormData((prev) => ({ ...prev, notes: val }))}
        error={errors.notes}
        isInvalid={errors.notes}
      />

      {/* Приватность */}
      <View style={styles.switchRow}>
        <Text>{t("private")}</Text>
        <Switch
          value={formData.private}
          onValueChange={(val) =>
            setFormData((prev) => ({ ...prev, private: val }))
          }
        />
      </View>
    </View>
  );
};

export default ObservationForm;

const styles = StyleSheet.create({
  formContainer: { padding: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    marginTop: 12,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
});
