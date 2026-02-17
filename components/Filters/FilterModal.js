import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View, ScrollView, StyleSheet } from "react-native";

import ModalWrapper from "../ui/ModalWrapper";
import DropdownInput from "../ui/DropdownInput";
import {
  fetchMyCountries,
  fetchMyPlaces,
  fetchSpecies,
} from "../../util/fetches";
import DateRangeFilter from "../ui/DateRangeFilter";
import { saveFilters } from "../../util/storageHelper";
import FlatButtonBottom from "../ui/FlatButtonBottom";
import { useLanguage } from "../../store/language-context";
import RadioGroup from "../ui/RadioGroup";
import { useTranslatedQuery } from "../../hooks/useQueryWithTranslation";

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
  const [speciesValue, setSpeciesValue] = useState(filters?.species ?? null);
  const [dateFilter, setDateFilter] = useState(dateFilterInitial);
  const [favouriteValue, setFavouriteValue] = useState(
    filters?.favourite ?? null,
  );

  const queryPlaces = useTranslatedQuery({
    queryFn: () => fetchMyPlaces(territoryValue),
    type: "places",
    params: [territoryValue],
    enabled: !!territoryValue,
  });

  const querySpecies = useTranslatedQuery({
    queryFn: () => fetchSpecies(territoryValue),
    type: "species",
    params: [territoryValue],
    enabled: !!territoryValue,
  });

  useEffect(() => {
    if (!queryPlaces.data) return;
    if (!territoryValue) setPlaceValue(null);
  }, [queryPlaces.data, placeValue]);

  useEffect(() => {
    if (!querySpecies.data) return;
    if (!territoryValue) setSpeciesValue(null);
  }, [querySpecies.data, territoryValue]);

  useEffect(() => {
    if (!visible) return;

    setTerritoryValue(filters?.territory ?? null);
    setPlaceValue(filters?.place ?? null);
    setSpeciesValue(filters?.species ?? null);
    setDateFilter(filters?.date ?? dateFilterInitial);
    setFavouriteValue(filters?.favourite ?? null);
  }, [visible, filters]);

  const isDateFilterActive = (date) => {
    if (!date) return false;
    if (date.mode === "any") return false;
    return !!(date.from || date.to || date.year);
  };

  const getNewFilters = () => {
    let res = {};
    if (allowed.includes("territory")) res.territory = territoryValue;
    if (allowed.includes("place")) res.place = placeValue;
    if (allowed.includes("species")) res.species = speciesValue;
    if (allowed.includes("date"))
      res.date = isDateFilterActive(dateFilter) ? dateFilter : null;
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
              value={territoryValue}
              setValue={setTerritoryValue}
              query={useTranslatedQuery({
                queryFn: fetchMyCountries,
                params: [language],
              })}
              allowReset
            />
          )}
          {allowed.includes("place") && (
            <DropdownInput
              title={t("location")}
              placeholder={t("all_locations")}
              value={placeValue}
              setValue={setPlaceValue}
              query={queryPlaces}
              allowReset
              disabled={!territoryValue}
              disabledMessage={t("select_country_first")}
            />
          )}

          {allowed.includes("species") && (
            <DropdownInput
              title={t("species")}
              placeholder={t("all_species")}
              value={speciesValue}
              setValue={setSpeciesValue}
              query={querySpecies}
              allowReset
              disabled={!territoryValue}
              disabledMessage={t("select_country_first")}
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
