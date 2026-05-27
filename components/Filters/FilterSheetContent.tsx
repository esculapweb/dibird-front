import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, StyleSheet, Pressable } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";

import DropdownInput from "../ui/DropdownInput";
import { useTheme } from "../../store/theme-context";
import {
  fetchMyCountries,
  fetchMyPlaces,
  fetchSpecies,
} from "../../util/fetches";
import DateRangeFilter from "../ui/DateRangeFilter";
import { useLanguage } from "../../store/language-context";
import RadioGroup from "../ui/RadioGroup";
import SpeciesOptionRow from "../ui/SpeciesOptionRow";
import { useLocation } from "../../store/location-context";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { useFilters } from "../../store/filters-context";
import { useLocationUnavailable } from "../../hooks/useLocationUnavailable";
import { Filters, AllowedFilterKey, DateFilter } from "../../types";
import { ThemeColors } from "../../store/theme-context";

interface FilterSheetContentProps {
  filters: Filters;
  allowed: AllowedFilterKey[];
  setFilters: (filters: Filters) => void;
  extraTerritory?: number | null;
  dismiss: () => void;
}

const FilterSheetContent = ({
  filters,
  allowed,
  setFilters,
  extraTerritory,
  dismiss,
}: FilterSheetContentProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const { setTerritory, date, setDate, setPlace, setSpecies } = useFilters();
  const {
    locationCoords,
    locationAvailable,
    permissionStatus,
    requestLocation,
  } = useLocation();

  const handleLocationUnavailable = useLocationUnavailable();

  const favouriteOptions: { label: string; value: boolean | null }[] = [
    { label: t("all"), value: null },
    { label: t("favourites_only"), value: true },
    { label: t("non_favourites_only"), value: false },
  ];

  const dateFilterInitial: DateFilter = {
    mode: "any",
    from: null,
    to: null,
    year: null,
    this_year: null,
    today: null,
  };

  const [territoryValue, setTerritoryValue] = useState<number | null>(
    filters?.territory ?? null,
  );
  const [placeValue, setPlaceValue] = useState<number | null>(
    filters?.place ?? null,
  );
  const [speciesValue, setSpeciesValue] = useState<number | null>(
    filters?.species ?? null,
  );
  const [dateFilter, setDateFilter] = useState<DateFilter>(
    filters?.date ?? dateFilterInitial,
  );
  const [favouriteValue, setFavouriteValue] = useState(
    filters?.favourite ?? null,
  );

  const effectiveTerritory: number | null =
    (allowed.includes("territory") ? territoryValue : extraTerritory) ?? null;

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
    requestLocation,
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

  const prevTerritoryRef = useRef<number | null>(null);

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

  const isDateFilterActive = (d: DateFilter): boolean => {
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

  const getNewFilters = (): Filters => {
    let res: Filters = {};
    if (allowed.includes("territory")) res.territory = territoryValue;
    if (allowed.includes("place")) res.place = placeValue;
    if (allowed.includes("species")) res.species = speciesValue;
    if (allowed.includes("date"))
      res.date = isDateFilterActive(dateFilter) ? dateFilter : undefined;
    if (allowed.includes("favourite")) res.favourite = favouriteValue;
    return res;
  };

  const applyHandler = async () => {
    const newFilters = getNewFilters();
    setFilters(newFilters);
    dismiss();

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
    <>
      <BottomSheetScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {allowed.includes("territory") && (
          <DropdownInput
            title={t("country")}
            placeholder={t("all_countries")}
            value={territoryValue}
            setValue={(value) => setTerritoryValue(value)}
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
            setValue={(value) => setPlaceValue(value)}
            query={queryPlaces}
            type="PlacesDropdown"
            sort={placesSort}
            onSortChange={onPlacesSortChange}
            allowReset
            disabled={!effectiveTerritory}
            disabledMessage={t("select_country_first")}
            locationAvailable={locationAvailable}
            onLocationUnavailable={handleLocationUnavailable}
            useDefault
          />
        )}
        {allowed.includes("species") && (
          <DropdownInput
            title={t("species")}
            placeholder={t("all_species")}
            value={speciesValue}
            setValue={(value) => setSpeciesValue(value as number | null)}
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
            useDefault
          />
        )}
        {allowed.includes("favourite") && (
          <View style={{ marginTop: 12 }}>
            <RadioGroup
              label={`${t("favourites")}:`}
              value={favouriteValue}
              onChange={(value) => setFavouriteValue(value as boolean | null)}
              direction="column"
              options={favouriteOptions}
            />
          </View>
        )}
        {allowed.includes("date") && (
          <DateRangeFilter value={dateFilter} setDateFilter={setDateFilter} />
        )}
      </BottomSheetScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.primaryButton} onPress={applyHandler}>
          <Text style={styles.primaryText}>{t("apply")}</Text>
        </Pressable>
      </View>
    </>
  );
};

export default FilterSheetContent;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 680,
      backgroundColor: Colors.primary100,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 90,
    },
    primaryButton: {
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
      backgroundColor: Colors.main100,
      marginTop: 8,
    },
    primaryText: {
      fontWeight: "600",
      fontSize: 15,
      color: Colors.textOpposite,
    },
    secondaryButton: {
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryText: {
      fontWeight: "500",
      fontSize: 15,
      color: Colors.textSecondary,
    },
    footer: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      backgroundColor: Colors.primary100,
    },
  });
