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
import RadioGroup from "../ui/RadioGroup";

const FilterModal = ({
  screen,
  visible,
  onClose,
  filters,
  allowed,
  setFilters,
  clearFilters,
}) => {
  const { language } = useLanguage();
  const { t } = useTranslation();

  const favouriteOptions = [
    { label: t("all"), value: null },
    { label: t("favourites_only"), value: true },
    { label: t("non_favourites_only"), value: false },
  ];

  const dateFilterInitial = {
    mode: "any",
    from: null,
    to: null,
    year: null,
  };

  const [territoryValue, setTerritoryValue] = useState(
    filters?.territory || null,
  );
  const [placeValue, setPlaceValue] = useState(filters?.place ?? null);
  const [dateFilter, setDateFilter] = useState(dateFilterInitial);
  const [favouriteValue, setFavouriteValue] = useState(
    filters?.favourite ?? null,
  );

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
    setFavouriteValue(filters?.favourite ?? null);
  }, [visible, filters]);

  const getNewFilters = () => {
    let res = {};
    if (allowed.includes("territory")) res.territory = territoryValue;
    if (allowed.includes("place")) res.place = placeValue;
    if (allowed.includes("date")) res.date = dateFilter;
    if (allowed.includes("favourite")) res.favourite = favouriteValue;
    return res;
  };

  const applyHandler = async () => {
    const newFilters = getNewFilters();
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
          {allowed.includes("territory") && (
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
          )}
          {allowed.includes("place") && (
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
          )}

          {allowed.includes("favourite") && (
            <View style={{ marginTop: 12 }}>
              <RadioGroup
                label={`${t("favourites")}:`}
                value={favouriteValue}
                onChange={setFavouriteValue}
                direction="column"
                options={favouriteOptions}
              />
            </View>
          )}

          {allowed.includes("date") && (
            <DateRangeFilter value={dateFilter} setDateFilter={setDateFilter} />
          )}
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
    padding: 16,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
  },
});
