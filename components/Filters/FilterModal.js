import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View, ScrollView, StyleSheet } from "react-native";

import ModalWrapper from "../ui/ModalWrapper";
import DropdownInput from "../ui/DropdownInput";
import { fetchMyCountries, fetchMyPlaces } from "../../util/fetches";
import DateRangeFilter from "../ui/DateRangeFilter";
import { saveFilters } from "../../util/storageHelper";
import FlatButtonBottom from "../ui/FlatButtonBottom";
import { useLanguage } from "../../store/language-context";

const FilterModal = ({
  screen,
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

  const [territoryValue, setTerritoryValue] = useState(
    filters?.territory || null,
  );
  const [placeValue, setPlaceValue] = useState(filters?.place || null);
  const [dateFilter, setDateFilter] = useState(dateFilterInitial);

  const loadPlaces = async () => {
    const places = await fetchMyPlaces(territoryValue);
    if (placeValue && !places.some((p) => p.value === placeValue))
      setPlaceValue(null);
    return places;
  };

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
    await saveFilters(screen, newFilters);
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
            loadOptions={fetchMyCountries}
            loadDependencies={[language]}
            allowReset
          />
          <DropdownInput
            title={t("location")}
            placeholder={t("all_locations")}
            initial={filters?.place}
            value={placeValue}
            setValue={setPlaceValue}
            loadOptions={loadPlaces}
            loadDependencies={[territoryValue]}
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
