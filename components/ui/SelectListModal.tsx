import { FlatList, View, StyleSheet, Text } from "react-native";
import { useEffect, useRef, useState, useMemo, ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import ModalWrapper from "./ModalWrapper";
import DefaultOptionRow from "./DefaultOptionRow";
import SearchInput from "./SearchInput";
import { sortOptionsList } from "../../util/sortOptionsList";
import RadioGroup from "./RadioGroup";
import FlatButtonBottom from "./FlatButtonBottom";
import ViewSwitch from "./ViewSwitch";
import PlacesMap from "../Map/PlacesMap";
import { useIsOnline } from "../../hooks/useIsOnline";
import { MapViewMode } from "../../hooks/useMapViewMode";
import { dropdownItemsToFeatureCollection } from "../../util/placeMapFeatures";
import { QueryType, DropdownItem, PlaceDropdownItem, Coords } from "../../types";

const ItemHeight = 52;

interface SelectListModalProps {
  visible: boolean;
  options: QueryType["data"];
  selected: string | number | null;
  onSelect: (value: string | number | null) => void;
  onClose: () => void;
  search: string;
  setSearch: (val: string) => void;
  title?: string;
  renderOption?: (props: {
    item: DropdownItem;
    selected: string | number | null;
    onSelect: (value: string | number | null) => void;
    onClose: () => void;
    index: number;
    multiple?: boolean;
    checked?: boolean;
    onToggle?: (value: string | number) => void;
  }) => ReactElement | null;
  type?: string;
  sort?: string | null;
  onSortChange?: (newSort: string | null) => void;
  locationAvailable?: boolean;
  onLocationUnavailable?: () => void;
  // Turns the list into multi-select: rows are checked instead of picked, and
  // "Done" hands the whole set to onConfirmMultiple. Only rows rendered
  // through `renderOption` know how to show a check mark (see
  // SpeciesOptionRow).
  allowMultiple?: boolean;
  selectedValues?: (string | number)[];
  onConfirmMultiple?: (values: (string | number)[]) => void;
  // Places only: a List/Map switch over the same options. The map needs the
  // tiles, so offline the switch is gone and the list is all there is.
  mapEnabled?: boolean;
  // A map tap on empty ground. Without it such a tap does nothing — the
  // filter only ever narrows to a place that already exists.
  onPickPoint?: (coords: Coords) => void;
}

const SelectListModal = ({
  visible,
  options,
  selected,
  onSelect,
  onClose,
  search,
  setSearch,
  title,
  renderOption,
  type,
  sort,
  onSortChange,
  locationAvailable = true,
  onLocationUnavailable,
  allowMultiple = false,
  selectedValues,
  onConfirmMultiple,
  mapEnabled = false,
  onPickPoint,
}: SelectListModalProps) => {
  const flatListRef = useRef<FlatList<DropdownItem>>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const sortOptions = type ? sortOptionsList(type) : [];
  const [sortOrder, setSortOrder] = useState(sort ?? null);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  // An array, not a Set: the selection order is the order the form shows the
  // chosen species in.
  const [draft, setDraft] = useState<(string | number)[]>([]);
  const [view, setView] = useState<MapViewMode>("list");
  const online = useIsOnline();
  // Losing the connection with the map open falls back to the list rather
  // than leaving MapL's offline placeholder as the only thing on screen.
  const showMap = mapEnabled && online && view === "map";

  // Every opening starts from what the form currently holds, so closing the
  // list without "Done" discards the checks made in it.
  useEffect(() => {
    if (!visible) return;
    const current = selectedValues?.length
      ? selectedValues
      : selected != null
        ? [selected]
        : [];
    setDraft(current);
    setView("list");
    // Dependencies are curated: only an opening reseeds the draft and view.
  }, [visible]);

  const toggleValue = (value: string | number) =>
    setDraft((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );

  const disabledSortValues = !locationAvailable
    ? sortOptions
        .filter((o) => o.value === "distance" || o.value === "-distance")
        .map((o) => o.value)
    : [];

  const normalizeYo = (str: string) => str.toLowerCase().replace(/ё/g, "е");

  const filteredOptions = useMemo(() => {
    if (!options || !search) return options ?? [];
    const normalizedSearch = normalizeYo(search);
    return options.filter((o) =>
      normalizeYo(o.label).includes(normalizedSearch),
    );
  }, [options, search]);

  useEffect(() => {
    setSortOrder(sort ?? null);
  }, [sort]);

  const mapFeatures = useMemo(
    () =>
      showMap
        ? dropdownItemsToFeatureCollection(filteredOptions as PlaceDropdownItem[])
        : null,
    [showMap, filteredOptions],
  );

  const viewOptions = useMemo(
    () => [
      { value: "list" as const, label: t("view_list"), icon: "list-outline" as const },
      { value: "map" as const, label: t("view_map"), icon: "map-outline" as const },
    ],
    [t],
  );

  const handleSortChange = (val: string | null) => {
    setSortOrder(val);
    setSortMenuVisible(false);
    onSortChange?.(val);
  };

  useEffect(() => {
    if (visible && !hasScrolled && flatListRef.current) {
      const selectedIndex = filteredOptions.findIndex(
        (o) => o.value === selected,
      );

      if (selectedIndex >= 0 && selectedIndex < filteredOptions.length) {
        setTimeout(() => {
          try {
            flatListRef.current?.scrollToIndex({
              index: selectedIndex,
              animated: false,
              viewPosition: 0.5,
            });
            setHasScrolled(true);
          } catch (e) {
            if (__DEV__) console.warn("scrollToIndex failed:", e);
          }
        }, 50);
      }
    }

    if (!visible) setHasScrolled(false);
  }, [visible, filteredOptions, selected]);

  return (
    <ModalWrapper
      visible={visible}
      onClose={onClose}
      title={title}
      showSortIcon={!!type && !showMap}
      onSort={() => setSortMenuVisible((prev) => !prev)}
    >
      {/* With no places yet the map still has a job: a tap on it adds the
          first one. */}
      {options?.length === 0 && !(mapEnabled && online && onPickPoint) ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t("no_options_available")}</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <SearchInput
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder={`${t("search")}...`}
            style={{ marginBottom: 8 }}
          />

          {mapEnabled && online && (
            <View style={styles.viewSwitch}>
              <ViewSwitch
                options={viewOptions}
                value={showMap ? "map" : "list"}
                onChange={(next) => {
                  setView(next);
                  setSortMenuVisible(false);
                }}
                testIDPrefix="place-picker-view"
              />
            </View>
          )}

          {sortMenuVisible && !showMap && (
            <View style={styles.sortMenu}>
              <RadioGroup
                label={`${t("sort_by")}:`}
                value={sortOrder}
                onChange={handleSortChange}
                direction="column"
                options={sortOptions}
                disabledValues={disabledSortValues}
                onDisabledPress={() => {
                  onLocationUnavailable?.();
                  onClose();
                }}
              />
            </View>
          )}

          {showMap && mapFeatures ? (
            <View style={styles.map}>
              <Text style={styles.mapHint}>
                {onPickPoint
                  ? t("place_picker_map_hint")
                  : t("place_picker_map_hint_select_only")}
              </Text>
              <PlacesMap
                featureCollection={mapFeatures}
                selectedId={typeof selected === "number" ? selected : null}
                onSelectPlace={(place) => onSelect(place.id)}
                onPressEmpty={
                  onPickPoint
                    ? (coords) => {
                        onClose();
                        onPickPoint(coords);
                      }
                    : undefined
                }
                showLegend={false}
                myLocationRightOffset={0}
              />
            </View>
          ) : filteredOptions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t("nothing_found")}</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={filteredOptions}
              keyExtractor={(item) => String(item.value)}
              keyboardShouldPersistTaps="handled"
              getItemLayout={(_, index) => ({
                length: ItemHeight,
                offset: ItemHeight * index,
                index,
              })}
              renderItem={({ item, index }) =>
                renderOption ? (
                  renderOption({
                    item,
                    selected,
                    onSelect,
                    onClose,
                    index,
                    multiple: allowMultiple,
                    checked: allowMultiple && draft.includes(item.value),
                    onToggle: toggleValue,
                  })
                ) : (
                  <DefaultOptionRow
                    item={item}
                    selected={selected}
                    onSelect={onSelect}
                    onClose={onClose}
                    itemHeight={ItemHeight}
                    index={index}
                  />
                )
              }
            />
          )}

          {allowMultiple && (
            <FlatButtonBottom
              onPress={() => onConfirmMultiple?.(draft)}
              icon="checkmark-outline"
              disabled={draft.length === 0}
              testID="select-multiple-done"
            >
              {t("done_count", { count: draft.length })}
            </FlatButtonBottom>
          )}
        </View>
      )}
    </ModalWrapper>
  );
};

export default SelectListModal;

const stylesFn = (Colors: ThemeColors) =>
  StyleSheet.create({
    empty: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    emptyText: {
      color: Colors.textSecondary,
      fontSize: 16,
      textAlign: "center",
    },
    sortMenu: {
      backgroundColor: Colors.primary100,
      borderRadius: 10,
      marginHorizontal: 12,
      marginBottom: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      shadowColor: Colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    viewSwitch: {
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    map: {
      flex: 1,
    },
    mapHint: {
      fontSize: 12,
      color: Colors.textSecondary,
      paddingHorizontal: 16,
      paddingBottom: 8,
      textAlign: "center",
    },
    content: {
      flex: 1,
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
    },
  });
