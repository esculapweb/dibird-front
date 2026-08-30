import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, StyleSheet, Pressable } from "react-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";

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
import { roundCoords } from "../../util/helpers";
import SpeciesOptionRow from "../ui/SpeciesOptionRow";
import { useLocation } from "../../store/location-context";
import { useDropdownQuery } from "../../hooks/useDropdownQuery";
import { useFilters } from "../../store/filters-context";
import { useLocationUnavailable } from "../../hooks/useLocationUnavailable";
import SearchInput from "../../components/ui/SearchInput";
import { RADIUS_OPTIONS_KM } from "../../constants/radiusOptions";
import {
  Filters,
  AllowedFilterKey,
  DateFilter,
  ObservationSource,
} from "../../types";
import { ThemeColors } from "../../store/theme-context";

interface FilterSheetContentProps {
  filters: Filters;
  allowed: AllowedFilterKey[];
  setFilters: (filters: Filters) => void;
  extraTerritory?: number | null;
  dismiss: () => void;
  showSearch?: boolean;
  initialSearch?: string;
  onSearchChange?: (value: string) => void;
}

const BUTTON_HEIGHT = 48;

const FilterSheetContent = ({
  filters,
  allowed,
  setFilters,
  extraTerritory,
  dismiss,
  showSearch,
  initialSearch = "",
  onSearchChange,
}: FilterSheetContentProps) => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = stylesFn(Colors, insets);
  const { setTerritory, date, setDate, setPlace, setSpecies } = useFilters();
  const {
    locationCoords,
    locationAvailable,
    permissionStatus,
    requestLocation,
  } = useLocation();
  const [localSearch, setLocalSearch] = useState(initialSearch);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    onSearchChange?.(val);
  };

  const handleClearSearch = () => {
    setLocalSearch("");
    onSearchChange?.("");
  };  

  const handleLocationUnavailable = useLocationUnavailable();

  const favouriteOptions: { label: string; value: boolean | null }[] = [
    { label: t("all"), value: null },
    { label: t("favourites_only"), value: true },
    { label: t("non_favourites_only"), value: false },
  ];

  const unsyncedOptions: { label: string; value: boolean | null }[] = [
    { label: t("all"), value: null },
    { label: t("unsynced_only"), value: true },
  ];

  const privateOptions: { label: string; value: boolean | null }[] = [
    { label: t("all"), value: null },
    { label: t("public_only"), value: false },
    { label: t("private_only"), value: true },
  ];

  const photoOptions: { label: string; value: boolean | null }[] = [
    { label: t("all"), value: null },
    { label: t("with_photo_only"), value: true },
    { label: t("without_photo_only"), value: false },
  ];

  const sourceOptions: { label: string; value: ObservationSource | null }[] = [
    { label: t("all"), value: null },
    { label: t("source_dibird"), value: "dibird" },
    { label: t("source_ebird"), value: "ebird" },
  ];

  const radiusOptions: { label: string; value: number }[] =
    RADIUS_OPTIONS_KM.map((km) => ({ label: `${km} ${t("km")}`, value: km }));

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
  const [unsyncedValue, setUnsyncedValue] = useState(
    filters?.unsynced ?? null,
  );
  const [privateValue, setPrivateValue] = useState(filters?.private ?? null);
  const [hasPhotoValue, setHasPhotoValue] = useState(filters?.has_photo ?? null);
  const [sourceValue, setSourceValue] = useState<ObservationSource | null>(
    filters?.source ?? null,
  );
  const [radiusValue, setRadiusValue] = useState<number | null>(
    filters?.radius ?? null,
  );

  // The radius is measured from the device's current position, and the server
  // silently ignores it without lng/lat — so the value is only accepted once
  // there actually is a fix. Same escalation as the distance sort in
  // useDropdownQuery: ask for the permission when it was never answered, and
  // send an already-denied user to the settings instead of re-prompting.
  const handleRadiusChange = async (value: number | null) => {
    if (value === null || locationAvailable) {
      setRadiusValue(value);
      return;
    }
    if (permissionStatus === "denied") {
      handleLocationUnavailable();
      return;
    }
    const fix = await requestLocation();
    if (fix) setRadiusValue(value);
    else handleLocationUnavailable();
  };

  // The three lists that offer it answer "unsynced" from this device's local
  // mutation queue alone and send nothing to the server, so every other filter
  // is ignored while it is on (see fetchObservations/fetchDiaries/fetchPlaces).
  // The controls keep their values — they are what the list goes back to once
  // this is switched off — but they are disabled to say they narrow nothing
  // right now, and FilterChips hides their chips for the same reason.
  const unsyncedOnly = allowed.includes("unsynced") && unsyncedValue === true;

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
    params: [effectiveTerritory, roundCoords(locationCoords)],
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
    if (allowed.includes("unsynced")) res.unsynced = unsyncedValue;
    if (allowed.includes("private")) res.private = privateValue;
    if (allowed.includes("has_photo")) res.has_photo = hasPhotoValue;
    if (allowed.includes("source")) res.source = sourceValue;
    if (allowed.includes("radius")) res.radius = radiusValue;
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
        {showSearch && (
          <SearchInput
            value={localSearch}
            onChange={handleSearchChange}
            onClear={handleClearSearch}
            placeholder={t("search_by_name")}
          />
        )}
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
            disabled={unsyncedOnly}
            disabledMessage={t("unsynced_ignores_other_filters")}
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
            disabled={unsyncedOnly || !effectiveTerritory}
            disabledMessage={
              unsyncedOnly
                ? t("unsynced_ignores_other_filters")
                : t("select_country_first")
            }
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
            disabled={unsyncedOnly || !effectiveTerritory}
            disabledMessage={
              unsyncedOnly
                ? t("unsynced_ignores_other_filters")
                : t("select_country_first")
            }
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
              disabled={unsyncedOnly}
            />
          </View>
        )}
        {allowed.includes("unsynced") && (
          <View style={{ marginTop: 12 }}>
            <RadioGroup
              label={`${t("sync_status")}:`}
              value={unsyncedValue}
              onChange={(value) => setUnsyncedValue(value as boolean | null)}
              direction="column"
              options={unsyncedOptions}
              testID="unsynced-filter"
            />
            {unsyncedOnly && (
              <Text style={styles.hint} testID="unsynced-only-hint">
                {t("unsynced_ignores_other_filters")}
              </Text>
            )}
          </View>
        )}
        {allowed.includes("private") && (
          <View style={{ marginTop: 12 }}>
            <RadioGroup
              label={`${t("privacy")}:`}
              value={privateValue}
              onChange={(value) => setPrivateValue(value as boolean | null)}
              direction="column"
              options={privateOptions}
              testID="private-filter"
              disabled={unsyncedOnly}
            />
          </View>
        )}
        {allowed.includes("has_photo") && (
          <View style={{ marginTop: 12 }}>
            <RadioGroup
              label={`${t("section_photos")}:`}
              value={hasPhotoValue}
              onChange={(value) => setHasPhotoValue(value as boolean | null)}
              direction="column"
              options={photoOptions}
              testID="has-photo-filter"
              disabled={unsyncedOnly}
            />
          </View>
        )}
        {allowed.includes("source") && (
          <View style={{ marginTop: 12 }}>
            <RadioGroup
              label={`${t("source")}:`}
              value={sourceValue}
              onChange={(value) =>
                setSourceValue(value as ObservationSource | null)
              }
              direction="column"
              options={sourceOptions}
              testID="source-filter"
              disabled={unsyncedOnly}
            />
          </View>
        )}
        {allowed.includes("radius") && (
          <DropdownInput
            title={t("radius")}
            placeholder={t("any_distance")}
            value={radiusValue}
            setValue={handleRadiusChange}
            query={{ data: radiusOptions }}
            allowReset
            disabled={unsyncedOnly}
            disabledMessage={t("unsynced_ignores_other_filters")}
          />
        )}
        {allowed.includes("date") && (
          // DateRangeFilter has no disabled state of its own — it is a group of
          // inputs rather than one control — so the wrapper swallows the taps.
          <View
            pointerEvents={unsyncedOnly ? "none" : "auto"}
            style={unsyncedOnly && styles.disabledBlock}
          >
            <DateRangeFilter value={dateFilter} setDateFilter={setDateFilter} />
          </View>
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

const stylesFn = (Colors: ThemeColors, insets: EdgeInsets) =>
  StyleSheet.create({
    scroll: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 680,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 96,
    },
    hint: {
      fontSize: 12,
      lineHeight: 16,
      color: Colors.textSecondary,
      marginTop: 4,
    },
    disabledBlock: {
      opacity: 0.4,
    },
    footer: {
      padding: 12,
      paddingBottom: Math.max(16, insets.bottom),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Colors.border,
      alignItems: "center",
    },
    primaryButton: {
      alignItems: "center",
      justifyContent: "center",
      height: BUTTON_HEIGHT,
      paddingHorizontal: 40,
      backgroundColor: Colors.main100,
      borderRadius: 8,
    },
    primaryText: {
      fontWeight: "600",
      fontSize: 16,
      textAlign: "center",
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
  });
