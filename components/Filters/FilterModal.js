import { useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import ModalWrapper from "../ui/ModalWrapper";
import DropdownInput from "../ui/DropdownInput";
import {
  loadDecorator,
  fetchMyCountries,
  fetchMyPlaces,
} from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import AnimatedLoadingButton from "../ui/AnimatedLoadingButton";

const FilterModal = ({ visible, onClose, filters, setFilters }) => {
  const { language } = useLanguage();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [territoryOptions, setTerritoryOptions] = useState([]);
  const [territoryValue, setTerritoryValue] = useState(
    filters?.territory || null,
  );
  const [placeOptions, setPlaceOptions] = useState([]);
  const [placeValue, setPlaceValue] = useState(filters?.place || null);

  useEffect(() => {
    const loadData = async () => {
      const countries = await fetchMyCountries(true);
      setTerritoryOptions(countries);
    };

    loadDecorator(loadData);
  }, [language]);

  useEffect(() => {
    const loadPlaces = async () => {
      const places = await fetchMyPlaces(territoryValue);
      setPlaceOptions(places);
      if (placeValue && !places.some((p) => p.value === placeValue))
        setPlaceValue(null);
    };
    loadDecorator(loadPlaces);
  }, [territoryValue]);

  const applyHandler = () => {
    setLoading(true);
    setFilters({
      territory: territoryValue,
      place: placeValue,
    });
    onClose();
    setLoading(false);
  };

  return (
    <ModalWrapper visible={visible} onClose={onClose} title={t("filters")}>
      <View style={styles.container}>
        <DropdownInput
          title={t("country")}
          placeholder={t("all_countries")}
          initial={filters?.territory}
          value={territoryValue}
          setValue={setTerritoryValue}
          options={territoryOptions}
          allowReset
        />
        <DropdownInput
          title={t("location")}
          placeholder={t("all_locations")}
          initial={filters?.place}
          value={placeValue}
          setValue={setPlaceValue}
          options={placeOptions}
          allowReset
        />

        <View style={styles.buttonContainer}>
          <AnimatedLoadingButton onPress={applyHandler} loading={loading}>
            {t("apply")}
          </AnimatedLoadingButton>
        </View>
      </View>
    </ModalWrapper>
  );
};

export default FilterModal;

const styles = StyleSheet.create({
  container: { padding: 18 },
  buttonContainer: { marginTop: 18 },
});
