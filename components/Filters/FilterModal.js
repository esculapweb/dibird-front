import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { View, ScrollView, StyleSheet, Alert } from "react-native";

import ModalWrapper from "../ui/ModalWrapper";
import DropdownInput from "../ui/DropdownInput";
import {
  fetchMyCountries,
  fetchMyPlaces,
  fetchSpecies,
} from "../../util/fetches";
import DateRangeFilter from "../ui/DateRangeFilter";
import FlatButtonBottom from "../ui/FlatButtonBottom";
import { useLanguage } from "../../store/language-context";
import RadioGroup from "../ui/RadioGroup";
import SpeciesOptionRow from "../ui/SpeciesOptionRow";
import { useLocationCoords } from "../../store/location-context";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { useFilters } from "../../store/filters-context";

const FilterModal = ({
  visible,
  onClose,
  filters,
  allowed,
  setFilters,
  clearFilters,
  extraTerritory,
}) => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { setTerritory, date, setDate, setPlace, setSpecies } = useFilters();
  const { locationCoords, locationAvailable, permissionStatus } =
    useLocationCoords();

  const handleLocationUnavailable = () => {
    Alert.alert(t("location_unavailable"), t("location_unavailable_hint"));
  };

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
    this_year: null,
    today: null,
  };

  const [territoryValue, setTerritoryValue] = useState(
    filters?.territory ?? null,
  );
  const [placeValue, setPlaceValue] = useState(filters?.place ?? null);
  const [speciesValue, setSpeciesValue] = useState(filters?.species ?? null);
  const [dateFilter, setDateFilter] = useState(dateFilterInitial);
  const [favouriteValue, setFavouriteValue] = useState(
    filters?.favourite ?? null,
  );

  const effectiveTerritory = allowed.includes("territory")
    ? territoryValue
    : extraTerritory;

  const {
    query: queryMyCountries,
    sort: countriesSort,
    onSortChange: onCountriesSortChange,
  } = useDropdownQuery({
    type: "CountriesDropdown",
    queryFn: (sort) => fetchMyCountries(false, sort),
    params: [language],
  });

  const {
    query: queryPlaces,
    sort: placesSort,
    onSortChange: onPlacesSortChange,
  } = useDropdownQuery({
    type: "PlacesDropdown",
    queryFn: (sort) => fetchMyPlaces(effectiveTerritory, locationCoords, sort),
    params: [effectiveTerritory, locationCoords],
    enabled: !!effectiveTerritory && allowed.includes("place"),
    locationAvailable,
    permissionStatus,
    onLocationUnavailable: handleLocationUnavailable,
  });

  const {
    query: querySpecies,
    sort: speciesSort,
    onSortChange: onSpeciesSortChange,
  } = useDropdownQuery({
    type: "SpeciesDropdown",
    queryFn: (sort) => fetchSpecies(effectiveTerritory, sort, date),
    params: [effectiveTerritory, language, date],
    enabled:
      !!effectiveTerritory && date !== undefined && allowed.includes("species"),
  });

  const prevTerritoryRef = useRef(null);

  useEffect(() => {
    if (prevTerritoryRef.current === null && effectiveTerritory !== null) {
      prevTerritoryRef.current = effectiveTerritory;
      return;
    }
    if (prevTerritoryRef.current !== effectiveTerritory) {
      setPlaceValue(null);
      setSpeciesValue(null);
      prevTerritoryRef.current = effectiveTerritory;
    }
  }, [effectiveTerritory]);

  useEffect(() => {
    if (!querySpecies.data || !speciesValue) return;

    const speciesExists = querySpecies.data.some(
      (item) => item.value === speciesValue,
    );
    if (!speciesExists) setSpeciesValue(null);
  }, [querySpecies.data]);

  useEffect(() => {
    if (!visible) return;

    setTerritoryValue(filters?.territory ?? null);
    setPlaceValue(filters?.place ?? null);
    setSpeciesValue(filters?.species ?? null);
    setDateFilter(filters?.date ?? dateFilterInitial);
    setFavouriteValue(filters?.favourite ?? null);
  }, [visible, filters]);

  const isDateFilterActive = (d) => {
    if (!d) return false;
    if (d.mode === "any") return false;
    return !!(
      d.from ||
      d.to ||
      d.year ||
      d.type === "today" ||
      d.type === "this_year"
    );
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
    onClose();

    if (allowed.includes("territory")) {
      const territoryChanged = newFilters.territory !== filters.territory;
      await setTerritory(newFilters.territory ?? null);
      if (territoryChanged) {
        await setPlace(null);
        await setSpecies(null);
      }
    }

    if (allowed.includes("date")) await setDate(newFilters.date ?? null);
    if (allowed.includes("place")) await setPlace(newFilters.place ?? null);

    if (allowed.includes("species") && !extraTerritory) {
      await setSpecies(newFilters.species ?? null);
    }
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
              query={queryMyCountries}
              type="CountriesDropdown"
              sort={countriesSort}
              onSortChange={onCountriesSortChange}
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
              type="PlacesDropdown"
              sort={placesSort}
              onSortChange={onPlacesSortChange}
              allowReset
              disabled={!effectiveTerritory}
              disabledMessage={t("select_country_first")}
              locationAvailable={locationAvailable}
              onLocationUnavailable={handleLocationUnavailable}
            />
          )}

          {allowed.includes("species") && (
            <DropdownInput
              title={t("species")}
              placeholder={t("all_species")}
              value={speciesValue}
              setValue={setSpeciesValue}
              query={querySpecies}
              type="SpeciesDropdown"
              sort={speciesSort}
              onSortChange={onSpeciesSortChange}
              allowReset
              disabled={!effectiveTerritory}
              disabledMessage={t("select_country_first")}
              renderOption={({ item, selected, onSelect, onClose }) => (
                <SpeciesOptionRow
                  item={item}
                  selected={selected}
                  onSelect={onSelect}
                  onClose={onClose}
                />
              )}
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
