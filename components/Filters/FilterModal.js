import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { ScrollView, StyleSheet } from "react-native";

import ModalWrapper from "../ui/ModalWrapper";
import DropdownInput from "../ui/DropdownInput";
import {
  loadDecorator,
  fetchMyCountries,
  fetchMyPlaces,
} from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import DateRangeFilter from "../ui/DateRangeFilter";

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

  const [dateFilter, setDateFilter] = useState({
    mode: "any",
    from: null,
    to: null,
    year: null,
  });

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
      date: dateFilter,
    });
    onClose();
    setLoading(false);
  };

  return (
    <ModalWrapper
      visible={visible}
      onClose={onClose}
      onApply={applyHandler}
      title={t("filters")}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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

        <DateRangeFilter value={filters.date} setDateFilter={setDateFilter} />
      </ScrollView>
    </ModalWrapper>
  );
};

export default FilterModal;

const styles = StyleSheet.create({
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
});
