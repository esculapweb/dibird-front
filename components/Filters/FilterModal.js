import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View, ScrollView, StyleSheet } from "react-native";

import ModalWrapper from "../ui/ModalWrapper";
import DropdownInput from "../ui/DropdownInput";
import {
  loadDecorator,
  fetchMyCountries,
  fetchMyPlaces,
} from "../../util/fetches";
import { useLanguage } from "../../store/language-context";
import DateRangeFilter from "../ui/DateRangeFilter";
import { saveFilters } from "../../util/filtersStorage";
import FlatButtonBottom from "../ui/FlatButtonBottom";

const FilterModal = ({
  visible,
  onClose,
  filters,
  setFilters,
  clearFilters,
}) => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const dateFilterInitial = {
    mode: "any",
    from: null,
    to: null,
    year: null,
  };

  const [territoryOptions, setTerritoryOptions] = useState([]);
  const [territoryValue, setTerritoryValue] = useState(
    filters?.territory || null,
  );
  const [placeOptions, setPlaceOptions] = useState([]);
  const [placeValue, setPlaceValue] = useState(filters?.place || null);
  const [dateFilter, setDateFilter] = useState(dateFilterInitial);

  useEffect(() => {
    const loadData = async () => {
      const countries = await fetchMyCountries();
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

  useEffect(() => {
    if (!visible) return;

    setTerritoryValue(filters?.territory ?? null);
    setPlaceValue(filters?.place ?? null);
    setDateFilter(filters?.date ?? dateFilterInitial);
  }, [visible, filters]);

  const applyHandler = async () => {
    const newFilters = {
      territory: territoryValue,
      place: placeValue,
      date: dateFilter,
    };
    setFilters(newFilters);
    await saveFilters(newFilters);
    onClose();
  };

  return (
    <ModalWrapper
      visible={visible}
      onClose={onClose}
      onApply={applyHandler}
      title={t("filters")}
    >
      <View style={styles.container}>
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

          <DateRangeFilter value={dateFilter} setDateFilter={setDateFilter} />
        </ScrollView>

        <FlatButtonBottom onPress={clearFilters}>
          {t("reset_filters")}
        </FlatButtonBottom>
      </View>
    </ModalWrapper>
  );
};

export default FilterModal;

const styles = StyleSheet.create({
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
  },
});
