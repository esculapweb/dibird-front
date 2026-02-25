import { View, StyleSheet, Switch, TextInput, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../store/theme-context";
import DropdownInput from "../ui/DropdownInput";
import DatePickerField from "../ui/DatePickerField";
import {
  fetchMyCountries,
  fetchMyPlaces,
  fetchSpecies,
} from "../../util/fetches";
import { useTranslatedQuery } from "../../hooks/useQueryWithTranslation";
import { useLanguage } from "../../store/language-context";

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
    type: "mycountries",
  });

  const queryPlaces = useTranslatedQuery({
    queryFn: () => fetchMyPlaces(territoryValue),
    params: [territoryValue],
    type: "places",
    enabled: !!territoryValue,
  });

  const querySpecies = useTranslatedQuery({
    queryFn: () => fetchSpecies(territoryValue),
    params: [territoryValue],
    type: "species",
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
      />

      {/* Дата и время */}
      <DatePickerField
        label="Дата наблюдения"
        date={formData.date_time}
        setDate={(newDate) => setFormData((prev) => ({ ...prev, date_time: newDate }))}
      />

      {/* Количество */}
      <TextInput
        style={styles.input}
        placeholder={t("quantity")}
        keyboardType="numeric"
        value={formData.quantity?.toString() || ""}
        onChangeText={(val) =>
          setFormData((prev) => ({ ...prev, quantity: val }))
        }
      />

      {/* Примечания */}
      <TextInput
        style={styles.input}
        placeholder={t("notes")}
        multiline
        value={formData.notes}
        onChangeText={(val) => setFormData((prev) => ({ ...prev, notes: val }))}
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
