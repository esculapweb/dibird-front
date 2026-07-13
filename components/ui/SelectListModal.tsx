import { FlatList, View, StyleSheet, Text } from "react-native";
import { useEffect, useRef, useState, useMemo, ReactElement } from "react";
import { useTranslation } from "react-i18next";

import { useTheme, ThemeColors } from "../../store/theme-context";
import ModalWrapper from "./ModalWrapper";
import DefaultOptionRow from "./DefaultOptionRow";
import SearchInput from "./SearchInput";
import { sortOptionsList } from "../../util/sortOptionsList";
import RadioGroup from "./RadioGroup";
import { QueryType, DropdownItem } from "../../types";

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
  }) => ReactElement | null;
  type?: string;
  sort?: string | null;
  onSortChange?: (newSort: string | null) => void;
  locationAvailable?: boolean;
  onLocationUnavailable?: () => void;
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
}: SelectListModalProps) => {
  const flatListRef = useRef<FlatList<DropdownItem>>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const styles = stylesFn(Colors);
  const sortOptions = type ? sortOptionsList(type) : [];
  const [sortOrder, setSortOrder] = useState(sort ?? null);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

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
      showSortIcon={!!type}
      onSort={() => setSortMenuVisible((prev) => !prev)}
    >
      {options?.length === 0 ? (
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

          {sortMenuVisible && (
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

          {filteredOptions.length === 0 ? (
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
                  renderOption({ item, selected, onSelect, onClose, index })
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
    content: {
      flex: 1,
      width: "100%",
      maxWidth: 680,
      alignSelf: "center",
    },
  });
